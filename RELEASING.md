# Releasing

## Versioning

This repo uses semantic-ish tags: `vMAJOR.MINOR.PATCH`.

## Create a release (local)

```bash
npm run lint
npm run build

git status
git commit -am "chore: prep release" # if needed
git tag -a v0.1.0 -m "v0.1.0"
git push origin main --tags
```

## Desktop package checks

Before claiming a desktop build is ready, run:

```bash
npm run desktop:build-doctor
npm run runtime:doctor
npm run desktop:prepare-sidecar
npm run desktop:smoke-test-sidecar
```

For a local desktop package:

```bash
npm run desktop:package
```

Expected Windows installer output:

- `src-tauri/target/release/bundle/nsis/*.exe`

Expected macOS app output:

- `src-tauri/target/release/bundle/macos/*.app`
- `src-tauri/target/release/bundle/dmg/*.dmg`

## Create a GitHub Release

On GitHub:
- Releases → Draft a new release
- Choose tag (e.g. `v0.1.0`)
- Use `docs/releases/v0.1.0.md` as the release body

Optional:
- Enable “Auto-generate release notes” (configured by `.github/release.yml`)
- Or trigger `Windows Desktop Package` to produce a Windows NSIS installer artifact
