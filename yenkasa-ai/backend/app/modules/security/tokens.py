from __future__ import annotations

from datetime import datetime
from datetime import timedelta
from uuid import uuid4

from jose import jwt


class TokenService:
    def __init__(self, settings) -> None:
        self.settings = settings

    def create_access_token(self, user_id: str, session_id: str, role: str) -> tuple[str, int]:
        expires_delta = timedelta(minutes=self.settings.access_token_ttl_minutes)
        expires_at = datetime.utcnow() + expires_delta
        payload = {
            "sub": user_id,
            "sid": session_id,
            "role": role,
            "type": "access",
            "iat": int(datetime.utcnow().timestamp()),
            "exp": int(expires_at.timestamp()),
        }
        token = jwt.encode(payload, self.settings.jwt_secret_key, algorithm=self.settings.jwt_algorithm)
        return token, int(expires_delta.total_seconds())

    def create_refresh_token(self, user_id: str, session_id: str) -> tuple[str, str, int]:
        expires_delta = timedelta(days=self.settings.refresh_token_ttl_days)
        expires_at = datetime.utcnow() + expires_delta
        jti = str(uuid4())
        payload = {
            "sub": user_id,
            "sid": session_id,
            "jti": jti,
            "type": "refresh",
            "iat": int(datetime.utcnow().timestamp()),
            "exp": int(expires_at.timestamp()),
        }
        token = jwt.encode(payload, self.settings.jwt_secret_key, algorithm=self.settings.jwt_algorithm)
        return token, jti, int(expires_delta.total_seconds())

    def decode_token(self, token: str, expected_type: str) -> dict:
        try:
            payload = jwt.decode(token, self.settings.jwt_secret_key, algorithms=[self.settings.jwt_algorithm])
        except Exception as exc:
            raise ValueError("Invalid or expired token.") from exc
        if payload.get("type") != expected_type:
            raise ValueError(f"Expected a {expected_type} token.")
        return payload
