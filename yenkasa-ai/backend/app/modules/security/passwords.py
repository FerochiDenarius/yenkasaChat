from __future__ import annotations

from passlib.context import CryptContext


class PasswordService:
    def __init__(self) -> None:
        self._context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    def hash_password(self, password: str) -> str:
        return self._context.hash(password)

    def verify_password(self, password: str, hashed_password: str) -> bool:
        return self._context.verify(password, hashed_password)
