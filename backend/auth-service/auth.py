"""JWT create/decode. Duplicated per Lambda folder — keep identical across services."""

import hashlib
import os
import time

import jwt

from db import connect

ALGORITHM = "HS256"
DEFAULT_EXPIRY = 8 * 60 * 60  # seconds
COOKIE_NAME = "acme_session"

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


def session_cookie(token: str = "", expires_in: int = DEFAULT_EXPIRY) -> str:
    """Set-Cookie value for the session. expires_in=0 clears it, for logout.

    SameSite=Lax is enough because the browser is always same-origin with the API:
    CloudFront serves /api/* from the same domain as the app, and locally the Vite
    proxy does. Secure only when deployed — the local stack is plain http, and a
    Secure cookie there is silently dropped.
    """
    secure = "; Secure" if os.environ.get("IS_LOCAL") == "false" else ""
    return f"{COOKIE_NAME}={token}; Max-Age={expires_in}; Path=/; HttpOnly; SameSite=Lax{secure}"


def cookie_token(event: dict, headers: dict) -> str | None:
    # Function URLs use payload format 2.0, which lifts cookies out of the headers
    # into their own list. The local proxy path can still deliver a plain Cookie
    # header, so read both rather than guessing which stack we are on.
    jar = list(event.get("cookies") or []) + headers.get("cookie", "").split(";")
    for crumb in jar:
        name, _, value = crumb.strip().partition("=")
        if name == COOKIE_NAME and value:
            return value
    return None


def request_token(event: dict) -> str | None:
    """The raw session token: the cookie first, then Authorization.

    The cookie is how the browser authenticates — it is HttpOnly, so no script can
    read it. Bearer stays for API clients that have no cookie jar (the smoke tests).
    """
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    token = cookie_token(event, headers)
    if token:
        return token
    value = headers.get("authorization", "")
    return value[7:] if value.lower().startswith("bearer ") else None


def fingerprint(token: str) -> str:
    """What the denylist stores. Never the token itself — see db/schema.sql."""
    return hashlib.sha256(token.encode()).hexdigest()


def revoke(token: str) -> None:
    """Stop this exact token working, for as long as it would have been valid."""
    try:
        exp = decode_access_token(token)["exp"]
    except jwt.PyJWTError:
        return  # already expired, or never ours: nothing to revoke
    with connect() as conn:
        conn.execute(
            "INSERT INTO revoked_tokens (token_hash, expires_at)"
            " VALUES (%s, to_timestamp(%s)) ON CONFLICT DO NOTHING",
            (fingerprint(token), exp),
        )
        # Revoked tokens are dead once they expire. Clearing them here keeps the
        # table bounded without a scheduled job to own.
        conn.execute("DELETE FROM revoked_tokens WHERE expires_at < now()")


def is_revoked(token: str) -> bool:
    # ponytail: one indexed lookup per authenticated request. If it ever shows up
    # in latency, the upgrade is short tokens plus a refresh endpoint.
    with connect() as conn:
        row = conn.execute(
            "SELECT 1 FROM revoked_tokens WHERE token_hash = %s", (fingerprint(token),)
        ).fetchone()
    return row is not None


def request_claims(event: dict) -> dict | None:
    """Claims for the caller, or None if there is no valid, unrevoked session."""
    token = request_token(event)
    if not token:
        return None
    try:
        claims = decode_access_token(token)
    except jwt.PyJWTError:
        return None
    # A signed, unexpired token is not enough: logout denies it before it expires.
    return None if is_revoked(token) else claims
