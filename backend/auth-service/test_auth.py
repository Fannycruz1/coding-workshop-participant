"""Phase 1: JWT create/decode."""

import time

import jwt
import pytest

import auth


def test_roundtrip_returns_claims():
    token = auth.create_access_token({"sub": "7", "role": "engineer"})
    claims = auth.decode_access_token(token)
    assert claims["sub"] == "7"
    assert claims["role"] == "engineer"


def test_expired_token_rejected():
    token = auth.create_access_token({"sub": "7"}, expires_in=-1)
    with pytest.raises(jwt.PyJWTError):
        auth.decode_access_token(token)


def test_tampered_token_rejected():
    token = auth.create_access_token({"sub": "7"})
    with pytest.raises(jwt.PyJWTError):
        auth.decode_access_token(token[:-2] + ("aa" if not token.endswith("aa") else "bb"))


def test_session_cookie_is_httponly_and_samesite():
    cookie = auth.session_cookie("abc")
    assert "acme_session=abc" in cookie
    # HttpOnly is the whole point: a script must not be able to read the session.
    assert "HttpOnly" in cookie
    assert "SameSite=Lax" in cookie


def test_session_cookie_secure_only_when_deployed(monkeypatch):
    monkeypatch.delenv("IS_LOCAL", raising=False)
    # The local stack is plain http; a Secure cookie there is dropped silently.
    assert "Secure" not in auth.session_cookie("abc")
    monkeypatch.setenv("IS_LOCAL", "false")
    assert "Secure" in auth.session_cookie("abc")


def test_logout_cookie_expires_immediately():
    assert "Max-Age=0" in auth.session_cookie(expires_in=0)


def test_claims_from_cookies_list():
    token = auth.create_access_token({"sub": "7", "role": "engineer"})
    event = {"cookies": [f"acme_session={token}"], "headers": {}}
    assert auth.request_claims(event)["sub"] == "7"


def test_claims_from_cookie_header():
    token = auth.create_access_token({"sub": "7", "role": "engineer"})
    event = {"headers": {"cookie": f"other=1; acme_session={token}"}}
    assert auth.request_claims(event)["sub"] == "7"


def test_claims_fall_back_to_bearer():
    token = auth.create_access_token({"sub": "9"})
    assert auth.request_claims({"headers": {"authorization": f"Bearer {token}"}})["sub"] == "9"


def test_tampered_cookie_rejected():
    token = auth.create_access_token({"sub": "7"})
    event = {"headers": {"cookie": f"acme_session={token[:-2]}xx"}}
    assert auth.request_claims(event) is None


def test_no_credentials_at_all():
    assert auth.request_claims({"headers": {}}) is None
