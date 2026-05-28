from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import uuid4

from app.models import UserDocument


class UserService:
    def __init__(self, mongo_service, password_service) -> None:
        self.mongo = mongo_service
        self.passwords = password_service

    @staticmethod
    def _clean_string(value: Any) -> str:
        return str(value or "").strip()

    @staticmethod
    def _normalize_role(document: dict[str, Any]) -> str:
        candidates = [
            document.get("staffRole"),
            document.get("roleName"),
            document.get("accessRole"),
            document.get("role"),
        ]
        for candidate in candidates:
            normalized = str(candidate or "").strip().lower().replace(" ", "_")
            if normalized:
                return normalized
        return "user"

    @staticmethod
    def _normalize_account_status(document: dict[str, Any]) -> str:
        suspended_until = document.get("suspendedUntil")
        if isinstance(suspended_until, datetime) and suspended_until > datetime.utcnow():
            return "suspended"
        return "active"

    async def create_user(self, payload) -> UserDocument:
        if not payload.agree_to_terms:
            raise ValueError("Terms of service must be accepted before registration.")

        email = payload.email.strip().lower()
        username = payload.username.strip()
        existing = await self.mongo.users_collection.find_one(
            {"$or": [{"email": email}, {"username": username}]},
            projection={"_id": 0, "email": 1, "username": 1},
        )
        if existing:
            raise ValueError("A user with that email or username already exists.")

        user = UserDocument(
            user_id=str(uuid4()),
            username=username,
            email=email,
            hashed_password=self.passwords.hash_password(payload.password),
            full_name=payload.full_name,
            country=payload.country,
            phone_number=payload.phone_number,
            signup_type=payload.signup_type,
            profile_image=payload.profile_image,
            created_at=datetime.utcnow(),
            terms_accepted_at=datetime.utcnow(),
            preferences={
                **payload.preferences,
                **({"preferred_language": payload.preferred_language} if payload.preferred_language else {}),
            },
            metadata={
                **payload.metadata,
                **({"captcha_code_supplied": bool(payload.captcha_code)} if payload.captcha_code else {}),
            },
        )
        await self.mongo.users_collection.insert_one(user.model_dump(mode="json"))
        return user

    async def get_by_email(self, email: str) -> UserDocument | None:
        document = await self.mongo.users_collection.find_one({"email": email.strip().lower()}, projection={"_id": 0})
        return UserDocument(**document) if document else None

    async def get_by_id(self, user_id: str) -> UserDocument | None:
        document = await self.mongo.users_collection.find_one({"user_id": user_id}, projection={"_id": 0})
        return UserDocument(**document) if document else None

    async def get_operational_user_by_email(self, email: str) -> dict[str, Any] | None:
        if self.mongo.operational_database is None:
            return None

        collection = self.mongo.get_collection(self.mongo.settings.mongodb_users_collection, operational=True)
        return await collection.find_one({"email": email.strip().lower()})

    async def sync_operational_user(self, operational_user: dict[str, Any], password: str) -> UserDocument:
        email = self._clean_string(operational_user.get("email")).lower()
        if not email:
            raise ValueError("Operational user record is missing an email address.")

        existing = await self.get_by_email(email)
        now = datetime.utcnow()
        preferred_language = self._clean_string(operational_user.get("preferredLanguage"))
        last_seen = operational_user.get("lastSeen") or (existing.last_seen if existing else None)
        role = self._normalize_role(operational_user) or (existing.role if existing else "user")

        user = UserDocument(
            user_id=existing.user_id if existing else str(uuid4()),
            username=self._clean_string(operational_user.get("username")) or (existing.username if existing else email.split("@", 1)[0]),
            email=email,
            hashed_password=self.passwords.hash_password(password),
            full_name=self._clean_string(operational_user.get("fullName")) or (existing.full_name if existing else None),
            country=self._clean_string(operational_user.get("country")) or (existing.country if existing else None),
            phone_number=self._clean_string(operational_user.get("phoneNumber")) or (existing.phone_number if existing else None),
            signup_type=self._clean_string(operational_user.get("accessRole")) or (existing.signup_type if existing else None),
            profile_image=self._clean_string(operational_user.get("profileImage")) or (existing.profile_image if existing else None),
            created_at=existing.created_at if existing else operational_user.get("createdAt") or now,
            terms_accepted_at=existing.terms_accepted_at if existing else now,
            last_seen=last_seen,
            role=role,
            account_status=self._normalize_account_status(operational_user),
            ai_usage_count=existing.ai_usage_count if existing else 0,
            total_tokens_used=existing.total_tokens_used if existing else 0,
            last_ai_interaction=existing.last_ai_interaction if existing else None,
            preferences={
                **(existing.preferences if existing else {}),
                **({"preferred_language": preferred_language} if preferred_language else {}),
            },
            metadata={
                **(existing.metadata if existing else {}),
                "auth_source": "yenkasa_app",
                "operational_user_id": str(operational_user.get("_id") or ""),
                "operational_role_name": self._clean_string(operational_user.get("roleName")),
                "operational_staff_role": self._clean_string(operational_user.get("staffRole")),
                "synced_at": now.isoformat(),
            },
        )

        await self.mongo.users_collection.update_one(
            {"email": email},
            {"$set": user.model_dump(mode="json")},
            upsert=True,
        )
        return user

    async def list_users(self, limit: int = 100) -> list[dict]:
        cursor = self.mongo.users_collection.find(
            {},
            projection={
                "_id": 0,
                "user_id": 1,
                "username": 1,
                "email": 1,
                "role": 1,
                "account_status": 1,
                "ai_usage_count": 1,
                "total_tokens_used": 1,
                "created_at": 1,
                "last_seen": 1,
            },
        ).sort("created_at", -1).limit(limit)
        return [row async for row in cursor]

    async def update_last_seen(self, user_id: str) -> None:
        await self.mongo.users_collection.update_one(
            {"user_id": user_id},
            {"$set": {"last_seen": datetime.utcnow()}},
        )

    async def increment_ai_usage(self, user_id: str, total_tokens: int) -> None:
        await self.mongo.users_collection.update_one(
            {"user_id": user_id},
            {
                "$inc": {"ai_usage_count": 1, "total_tokens_used": total_tokens},
                "$set": {"last_ai_interaction": datetime.utcnow(), "last_seen": datetime.utcnow()},
            },
        )
