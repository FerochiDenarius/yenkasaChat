# Repository Chat

`POST /api/repo/chat` performs:

1. JWT and session validation
2. semantic repository retrieval
3. prompt assembly with file paths and line ranges
4. Gemini reasoning over the retrieved context
5. AI tracking and YME event emission

The prompt intentionally tells Gemini to:

- stay within supplied repository context
- surface uncertainty when retrieval is weak
- answer in engineering terms
- cite concrete files and ranges

Tracked metadata includes:

- feature name (`repo_chat`)
- response latency
- estimated token usage
- inferred topics
- inferred coding languages
