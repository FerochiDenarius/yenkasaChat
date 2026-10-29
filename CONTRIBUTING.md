# Contributing

## Before opening a pull request

Run the checks relevant to your change:

```bash
npm run test:backend
npm run lint:backend
npm run format:check
npm run build:web
./gradlew test
```

Do not commit `.env`, credentials, generated bundles, uploaded media, or local build output. Add tests for changed backend behavior and keep error responses free of secrets or stack traces.

## Commit and pull request guidance

- Use a focused branch for each change.
- Explain the behavior change and its test coverage.
- Include migration or deployment notes when configuration changes.
- Keep API contracts backward compatible unless the pull request explicitly documents a breaking change.
