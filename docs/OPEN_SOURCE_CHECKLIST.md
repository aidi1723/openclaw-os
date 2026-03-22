# Open Source Checklist

Use this before publishing the repository.

## 1) Remove build artifacts

Ensure these are not committed:
- `node_modules/`
- `.next/`
- `.next-dev/`
- `.webhook-connector/`
- `dist/`
- `build/`

Useful check:

```bash
git ls-files | egrep '^(node_modules/|\.next/|\.next-dev/|dist/|build/|\.webhook-connector/)'
```

## 2) Scan for secrets and identifiers

Recommended commands:

```bash
rg -n "apiKey|token|Authorization|Bearer|secret|password" -g '!node_modules/**' -g '!.next/**' -g '!.next-dev/**' .
rg -n "email|phone|address|company|domain" -g '!node_modules/**' -g '!.next/**' -g '!.next-dev/**' .
find . \( -name '.env' -o -name '.env.*' -o -name '*.pem' -o -name '*.key' -o -name '*.p12' -o -name '*.sqlite' -o -name '*.db' \)
```

Important:
- Placeholder fields like `token` in source code may be valid if they do **not** include real secrets.
- If you ever committed real secrets, rewrite git history before publishing.

## 3) Verify license + policy docs

Confirm these files exist and are current:
- `LICENSE`
- `README.md`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `docs/PRIVACY.md`

## 4) Verify repository presentation

Before announcing the repo, check:
- repository description is clear
- README renders well on GitHub
- initial release tag exists
- release notes are ready
- issue / PR templates are present

## 5) GitHub repo settings

Recommended:
- Enable Issues
- Add Discussions if community collaboration is wanted
- Add branch protection on `main` if multiple contributors are expected
- Configure Dependabot / code scanning later if needed

## 6) Final local verification

```bash
npm run lint
npm run build
git status
```

## 6.1) Command-line release sanity

For the current public release line, the recommended distribution path is command-line install from source.

Before publishing:

- ensure README points to command-line install first
- ensure `docs/COMMAND_LINE_INSTALL.zh-CN.md` matches the current version
- ensure release notes do not promise DMG / EXE installers unless they really exist
- ensure version numbers match across:
  - `package.json`
  - `src-tauri/Cargo.toml`
  - `src-tauri/tauri.conf.json`

## 7) Final release sanity check

Before pushing or tagging, ask:
- Is there anything private in screenshots, docs, sample content, or logs?
- Are all external-service references intentional and safe to disclose?
- Would I be comfortable if this repo were indexed and mirrored publicly today?
