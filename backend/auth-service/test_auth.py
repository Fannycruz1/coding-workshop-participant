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
