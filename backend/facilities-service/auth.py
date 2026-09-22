"""JWT create/decode. Duplicated per Lambda folder — keep identical across services."""

import os
import time

import jwt

ALGORITHM = "HS256"
DEFAULT_EXPIRY = 8 * 60 * 60  # seconds

# Terraform injects JWT_SECRET (infra/main.tf random_password) into every Lambda.
# Only local dev may fall back; IS_LOCAL="false" means deployed, so refuse to start.
SECRET = os.environ.get("JWT_SECRET")
if not SECRET:
    if os.environ.get("IS_LOCAL") == "false":
        raise RuntimeError("JWT_SECRET is not set")
    SECRET = "dev-secret-change-me"


def create_access_token(claims: dict, expires_in: int = DEFAULT_EXPIRY) -> str:
    return jwt.encode({**claims, "exp": int(time.time()) + expires_in}, SECRET, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Returns the claims, or raises jwt.PyJWTError if expired/tampered/malformed."""
    return jwt.decode(token, SECRET, algorithms=[ALGORITHM])


def bearer_claims(event: dict) -> dict | None:
    """Claims from the request's Authorization header, or None if absent/invalid."""
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    value = headers.get("authorization", "")
    if not value.lower().startswith("bearer "):
        return None
    try:
        return decode_access_token(value[7:])
    except jwt.PyJWTError:
        return None
