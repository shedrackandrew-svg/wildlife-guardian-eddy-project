from __future__ import annotations

import os
import re
import signal
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.request import urlopen


def _log(message: str) -> None:
    print(message, flush=True)


def _is_port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.7)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def _wait_for_port(port: int, timeout_sec: float = 20.0) -> bool:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        if _is_port_open(port):
            return True
        time.sleep(0.25)
    return False


def _probe_local_api(port: int, timeout_sec: float = 30.0) -> bool:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        try:
            with urlopen(f"http://127.0.0.1:{port}/health", timeout=3) as response:
                if 200 <= response.status < 500:
                    return True
        except Exception:
            pass
        time.sleep(1.0)
    return False


def _is_public_url_reachable(public_url: str, timeout: float = 8.0) -> bool:
    try:
        with urlopen(public_url, timeout=timeout) as response:
            return 200 <= response.status < 500
    except Exception:
        return False


def _save_current_link(public_url: str) -> None:
    Path("live_link.txt").write_text(public_url + "\n", encoding="utf-8")


def _start_local_server(port: int) -> subprocess.Popen[str] | None:
    if _is_port_open(port):
        _log(f"Local server already running on port {port}; reusing it.")
        return None

    _log(f"Starting local server on http://127.0.0.1:{port} ...")
    return subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            str(port),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def _extract_tunnel_url(line: str) -> str:
    match = re.search(r"https://[A-Za-z0-9.-]+", line)
    if not match:
        return ""
    url = match.group(0).strip()
    if any(
        host in url
        for host in [
            ".lhr.life",
            ".trycloudflare.com",
            ".ngrok-free.app",
            ".ngrok.io",
        ]
    ):
        return url
    return ""


def _start_localhostrun_tunnel(port: int, timeout_sec: float = 60.0) -> tuple[str, subprocess.Popen[str]]:
    log_path = Path(tempfile.gettempdir()) / f"wildguard-localhost-run-{int(time.time() * 1000)}.log"

    with open(log_path, "w", encoding="utf-8", errors="ignore") as log_handle:
        proc = subprocess.Popen(
            [
                "ssh",
                "-o",
                "BatchMode=yes",
                "-o",
                "ExitOnForwardFailure=yes",
                "-o",
                "StrictHostKeyChecking=no",
                "-o",
                "ServerAliveInterval=20",
                "-o",
                "ServerAliveCountMax=3",
                "-R",
                f"80:127.0.0.1:{port}",
                "nokey@localhost.run",
            ],
            stdout=log_handle,
            stderr=subprocess.STDOUT,
            text=True,
        )

    deadline = time.time() + timeout_sec
    consumed = 0
    public_url = ""

    while time.time() < deadline:
        if log_path.exists():
            text = log_path.read_text(encoding="utf-8", errors="ignore")
            if len(text) > consumed:
                chunk = text[consumed:]
                consumed = len(text)
                for line in chunk.splitlines():
                    candidate = _extract_tunnel_url(line)
                    if candidate:
                        public_url = candidate
                        break

        if public_url:
            break

        if proc.poll() is not None:
            break

        time.sleep(0.4)

    if not public_url:
        raise RuntimeError("localhost.run did not return a public URL")

    return public_url, proc


def _start_cloudflare_token_tunnel(port: int, token: str, public_url: str) -> tuple[str, subprocess.Popen[str]]:
    proc = subprocess.Popen(
        [
            "cloudflared",
            "tunnel",
            "--no-autoupdate",
            "--url",
            f"http://127.0.0.1:{port}",
            "run",
            "--token",
            token,
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        text=True,
    )

    time.sleep(3)
    if proc.poll() is not None:
        raise RuntimeError("Cloudflare token tunnel stopped immediately")
    if not public_url:
        raise RuntimeError("CLOUDFLARE_PUBLIC_URL is required with CLOUDFLARE_TUNNEL_TOKEN")

    return public_url.rstrip("/"), proc


def _terminate_if_running(proc: subprocess.Popen[str] | None) -> None:
    try:
        if proc is not None and proc.poll() is None:
            proc.terminate()
    except Exception:
        pass


def _print_links(public_url: str, port: int) -> None:
    _log("\n=== WildGuard Live URL ===")
    _log(public_url)
    _log(f"Local API: http://127.0.0.1:{port}")
    _log(f"Home: {public_url}/")
    _log(f"Dashboard: {public_url}/dashboard")
    _log(f"Live share: {public_url}/live")
    _log("Multiple remote devices can open this same link concurrently.")
    _log("=================================\n")


def _open_tunnel(port: int) -> tuple[str, subprocess.Popen[str], str]:
    cloudflare_token = os.getenv("CLOUDFLARE_TUNNEL_TOKEN", "").strip()
    cloudflare_public_url = os.getenv("CLOUDFLARE_PUBLIC_URL", "").strip()

    if cloudflare_token:
        _log("Attempting stable Cloudflare token tunnel mode...")
        public_url, proc = _start_cloudflare_token_tunnel(port, cloudflare_token, cloudflare_public_url)
        return public_url, proc, "cloudflare-token"

    _log("Using temporary localhost.run tunnel mode...")
    public_url, proc = _start_localhostrun_tunnel(port)
    return public_url, proc, "localhost-run"


def main() -> int:
    port = int(os.getenv("LIVE_PORT", "8000"))
    target_hours = float(os.getenv("LIVE_TARGET_HOURS", "5"))

    Path("data/images").mkdir(parents=True, exist_ok=True)
    Path("data/animal_profiles").mkdir(parents=True, exist_ok=True)

    server_proc: subprocess.Popen[str] | None = None
    tunnel_proc: subprocess.Popen[str] | None = None

    try:
        server_proc = _start_local_server(port)
        if not _wait_for_port(port):
            raise RuntimeError(f"Local server did not become ready on port {port}")
        if not _probe_local_api(port):
            raise RuntimeError("Local API health check failed")

        public_url, tunnel_proc, mode = _open_tunnel(port)
        _save_current_link(public_url)
        _print_links(public_url, port)
        _log("Live URL is also saved in live_link.txt")
        if mode == "cloudflare-token":
            _log("Stable mode active: with valid Cloudflare token/domain, sessions can run many hours.")
        else:
            _log("Temporary mode active: provider may rotate URL periodically.")
        _log(f"Target runtime session: {target_hours:.1f} hours (as long as provider allows).")
        _log("Server is running. Press CTRL+C to stop.")

        unreachable_streak = 0
        last_heartbeat = 0.0
        started = time.time()

        while True:
            if server_proc is not None and server_proc.poll() is not None:
                raise RuntimeError("Local API server stopped unexpectedly")

            if tunnel_proc is not None and tunnel_proc.poll() is not None:
                _log("Tunnel process stopped. Reconnecting...")
                public_url, tunnel_proc, mode = _open_tunnel(port)
                _save_current_link(public_url)
                _print_links(public_url, port)
                unreachable_streak = 0

            if _is_public_url_reachable(public_url):
                unreachable_streak = 0
            else:
                unreachable_streak += 1

            # For temporary tunnels, rotate dead URLs automatically.
            if mode == "localhost-run" and unreachable_streak >= 3:
                _log("Public URL became unreachable. Rotating temporary tunnel link...")
                _terminate_if_running(tunnel_proc)
                public_url, tunnel_proc, mode = _open_tunnel(port)
                _save_current_link(public_url)
                _print_links(public_url, port)
                unreachable_streak = 0

            now = time.time()
            if now - last_heartbeat >= 30:
                elapsed_hours = (now - started) / 3600.0
                _log(f"[heartbeat] mode={mode} elapsed={elapsed_hours:.2f}h active link: {public_url}")
                last_heartbeat = now

            time.sleep(10.0)

    except KeyboardInterrupt:
        return 0
    except Exception as exc:
        _log(f"Failed to start live server: {exc}")
        return 1
    finally:
        _terminate_if_running(tunnel_proc)
        _terminate_if_running(server_proc)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal.default_int_handler)
    sys.exit(main())
