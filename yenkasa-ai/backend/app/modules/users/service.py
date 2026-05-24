from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from app.models import UserDocument


class UserService:
    def __init__(self, mongo_service, password_service) -> None:
        self.mongo = mongo_service
        self.passwords = password_service

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
