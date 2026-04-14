from __future__ import annotations

import os
import signal
import sys
from pathlib import Path

import uvicorn
from pyngrok import ngrok


def main() -> int:
    host = os.getenv("LIVE_HOST", "0.0.0.0")
    port = int(os.getenv("LIVE_PORT", "8000"))
    region = os.getenv("NGROK_REGION", "us")
    authtoken = os.getenv("NGROK_AUTHTOKEN", "").strip()

    if authtoken:
        ngrok.set_auth_token(authtoken)

    # Ensure common project directories exist before serving.
    Path("data/images").mkdir(parents=True, exist_ok=True)
    Path("data/animal_profiles").mkdir(parents=True, exist_ok=True)

    tunnel = None
    try:
        tunnel = ngrok.connect(addr=port, proto="http", bind_tls=True, region=region)
        public_url = tunnel.public_url
        print("\n=== Wildlife Guardian Live URL ===")
        print(public_url)
        print("Dashboard:", f"{public_url}/")
        print("Live share:", f"{public_url}/live")
        print("Admin:", f"{public_url}/admin")
        print("=================================\n")

        print("Server is running. Press CTRL+C to stop.")
        uvicorn.run("app.main:app", host=host, port=port, reload=False)
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


if __name__ == "__main__":
    # Graceful stop on CTRL+C in terminals where signal handling is strict.
    signal.signal(signal.SIGINT, signal.default_int_handler)
    sys.exit(main())
