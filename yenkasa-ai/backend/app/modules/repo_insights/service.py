from __future__ import annotations

from app.modules.repo_insights.analyzer import analyze_repository_chunks
from app.schemas import RecommendationItem
from app.schemas import RecommendationsResponse
from app.schemas import RepoInsightItem
from app.schemas import RepoInsightsResponse


class RepoInsightsService:
    def __init__(self, settings, mongo_service, vector_service) -> None:
        self.settings = settings
        self.mongo = mongo_service
        self.vector = vector_service

    async def regenerate(self, repo_name: str) -> RepoInsightsResponse:
        chunks = await self.vector.fetch_repo_chunks(repo_name)
        insights = analyze_repository_chunks(
            repo_name=repo_name,
            chunks=chunks,
            large_file_threshold_lines=self.settings.repo_insight_large_file_lines,
        )
        await self.mongo.insights_collection.delete_many({"repo_name": repo_name})
        if insights:
            await self.mongo.insights_collection.insert_many([item.model_dump(mode="json") for item in insights])
        return await self.list(repo_name=repo_name)

    async def list(self, repo_name: str | None = None, limit: int = 100) -> RepoInsightsResponse:
        query = {"repo_name": repo_name} if repo_name else {}
        cursor = self.mongo.insights_collection.find(query, projection={"_id": 0}).sort("created_at", -1).limit(limit)
        rows = [RepoInsightItem(**row) async for row in cursor]
        summary = [item.title for item in rows[:5]]
        return RepoInsightsResponse(repo_name=repo_name, count=len(rows), insights=rows, summary=summary)

    async def recommendations(self, repo_name: str | None = None) -> RecommendationsResponse:
        insights_response = await self.list(repo_name=repo_name, limit=50)
        recommendations: list[RecommendationItem] = []

        for item in insights_response.insights[:10]:
            if item.insight_type == "oversized_file":
                recommendations.append(
                    RecommendationItem(
                        category="maintainability",
                        priority="high",
                        recommendation=f"Decompose {item.file_path} into smaller domain or controller units.",
                        rationale=item.description,
                    )
                )
            elif item.insight_type == "duplicated_responsibility":
                recommendations.append(
                    RecommendationItem(
                        category="architecture",
                        priority="medium",
                        recommendation=f"Consolidate duplicated logic around {item.metadata.get('symbol', 'shared behavior')}.",
                        rationale=item.description,
                    )
                )
            elif item.insight_type == "scaling_bottleneck":
                recommendations.append(
                    RecommendationItem(
                        category="scaling",
                        priority="high",
                        recommendation="Move blocking or operationally risky code onto isolated async or worker paths.",
                        rationale=item.description,
                    )
                )
            elif item.insight_type == "technical_debt":
                recommendations.append(
                    RecommendationItem(
                        category="technical_debt",
                        priority="medium",
                        recommendation=f"Schedule cleanup work for {item.file_path} before new features land in the same area.",
                        rationale=item.description,
                    )
                )

        if not recommendations:
            recommendations.append(
                RecommendationItem(
                    category="readiness",
                    priority="medium",
                    recommendation="Ingest at least one repository to generate code-aware recommendations.",
                    rationale="No repository insights are stored yet.",
                )
            )

        return RecommendationsResponse(repo_name=repo_name, recommendations=recommendations[:10])
