"""Phase 1: password hashing primitives."""

import security


def test_hash_verify_roundtrip():
    h = security.hash_password("Password123!")
    assert h != "Password123!"
    assert h.startswith("$2b$")
    assert security.verify_password("Password123!", h)


def test_wrong_password_rejected():
    assert not security.verify_password("nope", security.hash_password("Password123!"))


def test_long_password_does_not_crash():
    # bcrypt truncates at 72 bytes; anything longer must still hash and verify.
    long = "a" * 200
    h = security.hash_password(long)
    assert security.verify_password(long, h)
