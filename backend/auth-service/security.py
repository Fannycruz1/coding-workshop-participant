"""Password hashing. Duplicated per Lambda folder — keep identical across services."""

import bcrypt

# bcrypt hashes at most 72 bytes; longer input must be truncated, not rejected.
MAX_BYTES = 72


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode()[:MAX_BYTES], bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode()[:MAX_BYTES], hashed.encode())
