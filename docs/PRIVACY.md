# Privacy

## What is stored locally

This project currently stores data in two places.

### Browser localStorage

The browser stores:

- LLM settings (API keys, base URLs, model names)
- Engine settings (base URL, token)
- Draft content and other local-first app records

### Server-side local files

The app server stores:

- Publishing connector tokens and webhook URLs
- Publish queue/job history
- Publish execution results and retry metadata

## Important

Neither browser localStorage nor the default file-backed server store should be treated as a production-grade secret store.

For any real deployment:
- Move secrets to server-side storage
- Add authentication and per-user isolation
- Consider encrypting secrets at rest

## Redaction

When opening issues or sharing screenshots/logs:
- Remove tokens, API keys, and any personal identifiers
