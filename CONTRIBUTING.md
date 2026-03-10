# Contributing

Thanks for contributing to **OpenClaw OS**.

## Before you start

Please read:
- `README.md`
- `docs/GETTING_STARTED.md`
- `docs/ARCHITECTURE.md`
- `docs/OPEN_SOURCE_CHECKLIST.md`

## Development setup

```bash
npm install
npm run dev
```

For a production-style check:

```bash
npm run lint
npm run build
```

## Contribution guidelines

### Keep changes focused
- Prefer small, reviewable pull requests
- Avoid mixing refactors, features, and docs in one PR when possible

### Respect project boundaries
- Keep the "local-first demo" assumptions explicit
- Do not add real social-platform automation unless it uses official APIs or clearly compliant connector patterns
- Do not add private identifiers, secrets, customer data, or internal URLs

### Documentation matters
If behavior changes, update the relevant docs:
- README
- architecture / connector docs
- privacy / deployment notes where relevant

## Pull request checklist

Before opening a PR:
- Run `npm run lint`
- Run `npm run build`
- Confirm no secrets or private identifiers were added
- Confirm no build artifacts were committed
- Update docs if the user-facing behavior changed

## Code style

- Prefer clarity over cleverness
- Keep naming literal and predictable
- Preserve the current architectural direction unless intentionally proposing a change
- If introducing a tradeoff, document it in the PR description

## Issues and feature requests

- Use bug reports for reproducible problems
- Use feature requests for enhancements or new capabilities
- For security-sensitive topics, follow `SECURITY.md`
