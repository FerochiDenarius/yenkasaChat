from __future__ import annotations


class ConsciousPromptInjector:
    def inject(self, context: str) -> str:
        return (
            "CURRENT OPERATIONAL STATE\n"
            "The following CRL context reflects live telemetry, memory, and repository evidence.\n"
            "Use it for incident reasoning, deployment awareness, and debugging answers.\n"
            "If evidence is partial, user-scoped, or conflicting, say that explicitly and cite the concrete signals you used.\n\n"
            f"{context}"
        )
