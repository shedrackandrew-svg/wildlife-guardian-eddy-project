from __future__ import annotations

import base64
import json
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    iterations = 120000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"pbkdf2_sha256${iterations}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algo, iterations_str, salt_b64, digest_b64 = stored_hash.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        iterations = int(iterations_str)
        salt = base64.b64decode(salt_b64.encode())
        expected = base64.b64decode(digest_b64.encode())
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def create_access_token(
    *,
    secret_key: str,
    algorithm: str,
    subject: str,
    user_id: int,
    is_admin: bool,
    expires_minutes: int,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "uid": user_id,
        "is_admin": is_admin,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=expires_minutes)).timestamp()),
    }
    if algorithm != "HS256":
        raise ValueError("Only HS256 is supported")

    header = {"alg": "HS256", "typ": "JWT"}

    def _b64url(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

    header_part = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_part = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_part}.{payload_part}".encode("ascii")
    signature = hmac.new(secret_key.encode("utf-8"), signing_input, hashlib.sha256).digest()
    sig_part = _b64url(signature)
    return f"{header_part}.{payload_part}.{sig_part}"


def decode_access_token(*, token: str, secret_key: str, algorithm: str) -> dict | None:
    if algorithm != "HS256":
        return None

    try:
        header_part, payload_part, sig_part = token.split(".", 2)
    except ValueError:
        return None

    def _b64url_decode(data: str) -> bytes:
        pad = "=" * (-len(data) % 4)
        return base64.urlsafe_b64decode((data + pad).encode("ascii"))

    try:
        signing_input = f"{header_part}.{payload_part}".encode("ascii")
        expected_sig = hmac.new(secret_key.encode("utf-8"), signing_input, hashlib.sha256).digest()
        actual_sig = _b64url_decode(sig_part)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        payload = json.loads(_b64url_decode(payload_part).decode("utf-8"))
        exp = payload.get("exp")
        if not isinstance(exp, int):
            return None
        if int(datetime.now(timezone.utc).timestamp()) >= exp:
            return None
        return payload
    except Exception:
        return None
