"""auth.py is copied per Lambda folder; the copies must stay byte-identical."""

import hashlib
import pathlib


def test_auth_copies_are_identical():
    copies = sorted(pathlib.Path(__file__).parent.parent.glob("backend/*/auth.py"))
    assert len(copies) >= 2
    digests = {p.parent.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in copies}
    assert len(set(digests.values())) == 1, digests
