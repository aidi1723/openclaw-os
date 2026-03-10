# Security

If you discover a security issue, please report it responsibly.

## Reporting

For sensitive issues, avoid posting full exploit details publicly at first.
You can:
- open a GitHub issue with minimal details, or
- contact the maintainers privately if a private channel is available

When reporting:
- do **not** include real API keys, tokens, passwords, or personal data
- include reproduction steps and impact summary
- include a minimal PoC only when necessary

## Current security posture

This repository is an early open-source framework/demo and is **not** a hardened production system by default.

Important limitations:
- API keys and tokens may be stored in browser localStorage in the current demo architecture
- there is no built-in multi-user auth model
- connector implementations are the responsibility of downstream integrators

## Deployment guidance

For any real deployment, especially multi-user or internet-facing deployments:
- move secrets to server-side storage
- add proper authentication and authorization
- isolate tenants and user data
- audit external connector behavior
- log carefully and avoid storing sensitive payloads unnecessarily

## Scope reminder

This project should not be used to bypass platform rules, automate against unofficial endpoints, or weaken account security controls.
