from __future__ import annotations

import os
import re
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

from dotenv import load_dotenv
from pyngrok import ngrok


def _is_port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.7)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def _start_local_server(host: str, port: int) -> subprocess.Popen[str] | None:
    if _is_port_open(port):
        print(f"Local server already running on port {port}; reusing it.")
        return None

    print(f"Starting local server on http://{host}:{port} ...")
    return subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            host,
            "--port",
            str(port),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )


def _wait_for_port(port: int, timeout_sec: float = 15.0) -> bool:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        if _is_port_open(port):
            return True
        time.sleep(0.25)
    return False


def _probe_local_api(port: int, timeout_sec: float = 20.0) -> bool:
    deadline = time.time() + timeout_sec
    health_url = f"http://127.0.0.1:{port}/health"
    while time.time() < deadline:
        try:
            with urlopen(health_url, timeout=3) as response:
                if response.status == 200:
                    return True
        except Exception:
            pass
        time.sleep(1.0)
    return False


def _start_ngrok(port: int, region: str, authtoken: str) -> tuple[str, object]:
    if not authtoken:
        raise RuntimeError("NGROK_AUTHTOKEN not set")
    ngrok.set_auth_token(authtoken)
    tunnel = ngrok.connect(addr=port, proto="http", bind_tls=True, region=region)
    return tunnel.public_url, tunnel


def _extract_public_url(line: str) -> str:
    line = line.strip()
    if not line:
        return ""

    if "localhost.run/docs" in line or "twitter.com/localhost_run" in line:
        return ""

    # localhost.run style
    if " tunneled with tls termination, https://" in line:
        candidate = line.split("https://", 1)[1].split()[0].strip()
        return f"https://{candidate}"

    # Generic URL extraction
    match = re.search(r"https://[a-zA-Z0-9._-]+", line)
    if not match:
        return ""

    candidate = match.group(0)
    if "localhost.run/docs" in candidate:
        return ""
    return candidate


def _start_localhostrun(port: int) -> tuple[str, subprocess.Popen[str]]:
    cmd = [
        "ssh",
        "-o",
        "StrictHostKeyChecking=no",
        "-R",
        f"80:localhost:{port}",
        "nokey@localhost.run",
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

    deadline = time.time() + 45
    found_url = ""
    while time.time() < deadline:
        if proc.poll() is not None:
            break
        line = proc.stdout.readline() if proc.stdout else ""
        found_url = _extract_public_url(line)
        if found_url:
            break

    if not found_url:
        raise RuntimeError("Failed to get URL from localhost.run tunnel process")
    return found_url, proc


def _start_pinggy(port: int) -> tuple[str, subprocess.Popen[str]]:
    # Free SSH reverse tunnel alternative when localhost.run is unstable.
    cmd = [
        "ssh",
        "-p",
        "443",
        "-o",
        "StrictHostKeyChecking=no",
        "-R",
        f"0:localhost:{port}",
        "a.pinggy.io",
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

    deadline = time.time() + 45
    found_url = ""
    while time.time() < deadline:
        if proc.poll() is not None:
            break
        line = proc.stdout.readline() if proc.stdout else ""
        found_url = _extract_public_url(line)
        if found_url:
            break

    if not found_url:
        raise RuntimeError("Failed to get URL from pinggy tunnel process")
    return found_url, proc


def main() -> int:
    load_dotenv(".env")

    host = os.getenv("LIVE_HOST", "0.0.0.0")
    port = int(os.getenv("LIVE_PORT", "8000"))
    region = os.getenv("NGROK_REGION", "us")
    authtoken = os.getenv("NGROK_AUTHTOKEN", "").strip()

    # Ensure common project directories exist before serving.
    Path("data/images").mkdir(parents=True, exist_ok=True)
    Path("data/animal_profiles").mkdir(parents=True, exist_ok=True)

    tunnel = None
    ssh_tunnel_proc: subprocess.Popen[str] | None = None
    server_proc: subprocess.Popen[str] | None = None
    try:
        server_proc = _start_local_server(host, port)
        if not _wait_for_port(port):
            raise RuntimeError(f"Local API did not become ready on port {port}")
        if not _probe_local_api(port):
            raise RuntimeError("Local API health check failed")

        public_url = ""
        try:
            public_url, tunnel = _start_ngrok(port, region, authtoken)
            print("Using ngrok tunnel provider.")
        except Exception as ngrok_exc:
            print(f"ngrok unavailable: {ngrok_exc}")
            print("Falling back to localhost.run tunnel provider...")
            try:
                public_url, ssh_tunnel_proc = _start_localhostrun(port)
                print("Using localhost.run tunnel provider.")
            except Exception as localhostrun_exc:
                print(f"localhost.run unavailable: {localhostrun_exc}")
                print("Falling back to pinggy tunnel provider...")
                public_url, ssh_tunnel_proc = _start_pinggy(port)
                print("Using pinggy tunnel provider.")

        print("\n=== Wildlife Guardian Live URL ===")
        print(public_url)
        print("Dashboard:", f"{public_url}/")
        print("Live share:", f"{public_url}/live")
        print("Admin:", f"{public_url}/admin")
        print("=================================\n")

        print("Server is running. Press CTRL+C to stop.")

        while True:
            if server_proc is not None and server_proc.poll() is not None:
                raise RuntimeError("Local API server stopped unexpectedly")
            if ssh_tunnel_proc is not None and ssh_tunnel_proc.poll() is not None:
                raise RuntimeError("Tunnel process stopped unexpectedly")
            time.sleep(1.0)

        return 0
    except KeyboardInterrupt:
        return 0
    except Exception as exc:
        print(f"Failed to start live server: {exc}")
        return 1
    finally:
        try:
            if tunnel is not None:
                ngrok.disconnect(tunnel.public_url)
            ngrok.kill()
        except Exception:
            pass

        try:
            if ssh_tunnel_proc is not None and ssh_tunnel_proc.poll() is None:
                ssh_tunnel_proc.terminate()
        except Exception:
            pass

        try:
            if server_proc is not None and server_proc.poll() is None:
                server_proc.terminate()
        except Exception:
            pass


if __name__ == "__main__":
    # Graceful stop on CTRL+C in terminals where signal handling is strict.
    signal.signal(signal.SIGINT, signal.default_int_handler)
    sys.exit(main())
