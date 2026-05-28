from __future__ import annotations

import logging

import bcrypt
from passlib.context import CryptContext
from passlib.exc import UnknownHashError


LOGGER = logging.getLogger("yenkasa_ai_cloud.auth.passwords")


class PasswordService:
    def __init__(self) -> None:
        self._context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    def hash_password(self, password: str) -> str:
        return self._context.hash(password)

    def identify_hash(self, hashed_password: str) -> str | None:
        if not hashed_password or not isinstance(hashed_password, str):
            return None
        try:
            return self._context.identify(hashed_password)
        except (TypeError, ValueError):
            return None

    def verify_legacy_bcrypt(self, password: str, hashed_password: str) -> bool:
        if not password or not hashed_password:
            return False

        encoded_hash = hashed_password.encode("utf-8", errors="ignore")
        if not encoded_hash.startswith((b"$2a$", b"$2b$", b"$2y$")):
            return False

        try:
            return bcrypt.checkpw(password.encode("utf-8"), encoded_hash)
        except ValueError:
            return False

    def verify_password(self, password: str, hashed_password: str) -> bool:
        if not password or not hashed_password or not isinstance(hashed_password, str):
            return False

        try:
            return self._context.verify(password, hashed_password)
        except UnknownHashError:
            LOGGER.warning("Unsupported password hash format encountered during verification.")
            return self.verify_legacy_bcrypt(password, hashed_password)
        except (TypeError, ValueError):
            return False
