from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from app.schemas import AuthTokenResponse
from app.schemas import CurrentUserResponse


def user_to_response(user) -> CurrentUserResponse:
    return CurrentUserResponse(
        user_id=user.user_id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        country=user.country,
        phone_number=user.phone_number,
        signup_type=user.signup_type,
        profile_image=user.profile_image,
        created_at=user.created_at,
        terms_accepted_at=user.terms_accepted_at,
        last_seen=user.last_seen,
        role=user.role,
        account_status=user.account_status,
        ai_usage_count=user.ai_usage_count,
        total_tokens_used=user.total_tokens_used,
        last_ai_interaction=user.last_ai_interaction,
        preferences=user.preferences,
        metadata=user.metadata,
    )


class AuthService:
    def __init__(self, settings, users_service, sessions_service, security_service) -> None:
        self.settings = settings
        self.users = users_service
        self.sessions = sessions_service
        self.security = security_service

    async def register(self, payload, ip_address: str | None, user_agent: str | None) -> AuthTokenResponse:
        await self.security.enforce_rate_limit(
            key=f"auth:register:{ip_address or 'unknown'}",
            limit=self.settings.auth_register_rate_limit,
            window_s=self.settings.auth_window_seconds,
            error_message="Too many registration attempts. Please try again later.",
        )
        user = await self.users.create_user(payload)
        return await self._issue_session_tokens(user, ip_address=ip_address, user_agent=user_agent)

    async def login(self, payload, ip_address: str | None, user_agent: str | None) -> AuthTokenResponse:
        await self.security.enforce_rate_limit(
            key=f"auth:login:{ip_address or 'unknown'}:{payload.email.strip().lower()}",
            limit=self.settings.auth_login_rate_limit,
            window_s=self.settings.auth_window_seconds,
            error_message="Too many login attempts. Please try again later.",
        )
        email = payload.email.strip().lower()
        user = await self.users.get_by_email(email)

        verified_locally = bool(
            user and self.security.passwords.verify_password(payload.password, user.hashed_password)
        )

        if not verified_locally:
            operational_user = await self.users.get_operational_user_by_email(email)
            operational_hash = str(operational_user.get("password") or "") if operational_user else ""
            verified_operationally = bool(
                operational_user and self.security.passwords.verify_password(payload.password, operational_hash)
            )

            if verified_operationally:
                user = await self.users.sync_operational_user(operational_user, payload.password)
            else:
                user = None

        if user is None:
            await self.security.record_alert(
                alert_type="failed_login",
                severity="medium",
                user_id=None,
                ip_address=ip_address,
                metadata={"email": email},
            )
            raise ValueError("Invalid email or password.")
        if user.account_status != "active":
            raise ValueError("This account is not active.")
        return await self._issue_session_tokens(user, ip_address=ip_address, user_agent=user_agent)

    async def logout(self, session_id: str) -> None:
        await self.sessions.invalidate_session(session_id)

    async def refresh(self, refresh_token: str) -> AuthTokenResponse:
        payload = self.security.tokens.decode_token(refresh_token, expected_type="refresh")
        user = await self.users.get_by_id(payload["sub"])
        if user is None:
            raise ValueError("User not found.")
        refresh_token_value, refresh_jti, refresh_expires = self.security.tokens.create_refresh_token(user.user_id, payload["sid"])
        session = await self.sessions.rotate_refresh_jti(
            session_id=payload["sid"],
            old_jti=payload["jti"],
            new_jti=refresh_jti,
        )
        access_token, access_expires = self.security.tokens.create_access_token(user.user_id, session.session_id, user.role)
        return AuthTokenResponse(
            access_token=access_token,
            refresh_token=refresh_token_value,
            access_token_expires_in=access_expires,
            refresh_token_expires_in=refresh_expires,
            session_id=session.session_id,
            user=user_to_response(user),
        )

    async def resolve_access_token(self, token: str):
        payload = self.security.tokens.decode_token(token, expected_type="access")
        session = await self.sessions.validate_active_session(payload["sid"])
        user = await self.users.get_by_id(payload["sub"])
        if user is None:
            raise ValueError("User account was not found.")
        if user.account_status != "active":
            raise ValueError("User account is not active.")
        await self.users.update_last_seen(user.user_id)
        return user, session

    async def _issue_session_tokens(self, user, ip_address: str | None, user_agent: str | None) -> AuthTokenResponse:
        session = await self.sessions.create_session(
            user_id=user.user_id,
            refresh_jti=str(uuid4()),
            ip_address=ip_address,
            user_agent=user_agent,
        )
        access_token, access_expires = self.security.tokens.create_access_token(user.user_id, session.session_id, user.role)
        refresh_token, refresh_jti, refresh_expires = self.security.tokens.create_refresh_token(user.user_id, session.session_id)
        await self.sessions.rotate_refresh_jti(session.session_id, session.refresh_jti, refresh_jti)
        await self.users.update_last_seen(user.user_id)
        user.last_seen = datetime.utcnow()
        return AuthTokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            access_token_expires_in=access_expires,
            refresh_token_expires_in=refresh_expires,
            session_id=session.session_id,
            user=user_to_response(user),
        )
