---
description: Update CHANGELOG.md based on git tags, merged PRs, and actual code diffs
argument-hint: "[optional: version range, e.g. v1.56.0..v1.61.1, or 'unreleased']"
---

Invoke the `update-changelog` skill via the Skill tool and follow its workflow to update `CHANGELOG.md`.

Scope hint from the user (may be empty): $ARGUMENTS

If no scope was given, default to: reconcile the full gap between the latest version present in `CHANGELOG.md` and the latest git tag, then refresh `[Unreleased]` for any commits past the latest tag (`<latest-tag>..origin/main`).

Reminders specific to this repo:
- Always pass `-c log.showSignature=false` to git (commits are GPG-signed).
- Use `--first-parent` to gather commits — squash merges (`… (#NNN)`) are invisible to `--merges`.
- The version lives in `package.json`, not `pyproject.toml`.

Do not run `make release`, edit `package.json`, or push tags — only edit `CHANGELOG.md`.
