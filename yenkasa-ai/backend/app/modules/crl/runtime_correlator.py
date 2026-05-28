from __future__ import annotations

from app.modules.crl.context_ranker import RankedContextItem


class RuntimeCorrelator:
    def correlate(self, question: str, ranked_items: list[RankedContextItem]) -> list[str]:
        lowered_question = question.lower()
        notes: list[str] = []

        for item in ranked_items[:8]:
            text = f"{item.envelope.title} {item.envelope.text}".lower()
            metadata = item.envelope.metadata
            file_path = metadata.get("file_path") or metadata.get("file") or item.envelope.raw.get("file_path")
            revision = metadata.get("revision") or metadata.get("deployment_revision")
            route = metadata.get("request_path") or metadata.get("route")
            processing_status = metadata.get("processing_status")
            processing_error = metadata.get("processing_error")
            app_version = metadata.get("app_version")
            client_platform = metadata.get("client_platform")

            if any(token in text for token in ("coroutine", "await", "async")):
                details = []
                if file_path:
                    details.append(f"file={file_path}")
                if route:
                    details.append(f"route={route}")
                if revision:
                    details.append(f"revision={revision}")
                suffix = f" ({', '.join(details)})" if details else ""
                notes.append(f"Async misuse signal detected{suffix}.")

            if processing_status == "failed" or processing_error:
                details = []
                if item.envelope.title:
                    details.append(f"event={item.envelope.title}")
                if client_platform:
                    details.append(f"platform={client_platform}")
                if app_version:
                    details.append(f"appVersion={app_version}")
                suffix = f" ({', '.join(details)})" if details else ""
                notes.append(f"Event processing failure detected{suffix}.")

            if "comment" in lowered_question and ("comment" in text or "comments" in text):
                notes.append(f"Comments-related operational signal: {item.envelope.title}.")
                if processing_status == "failed" or processing_error:
                    notes.append(f"Comments pipeline failure surfaced in {item.envelope.source}: {item.envelope.title}.")

            if "deployment" in lowered_question and revision:
                notes.append(f"Deployment context references revision {revision}.")

            if "server.js" in lowered_question and ("server.js" in text or str(file_path).endswith("server.js")):
                notes.append(f"server.js related evidence found in {item.envelope.source}.")

        deduped: list[str] = []
        seen: set[str] = set()
        for note in notes:
            if note in seen:
                continue
            seen.add(note)
            deduped.append(note)
        return deduped[:6]
