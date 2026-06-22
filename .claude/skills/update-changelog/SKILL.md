---
name: update-changelog
description: Update CHANGELOG.md comprehensively based on git tags, merged PRs, and actual code diffs. Use when the user asks to "update the changelog", backfill missing versions, prepare a release, or reconcile [Unreleased] entries against shipped tags. Produces Keep-a-Changelog entries that describe user-facing impact, not implementation details.
allowed-tools: Bash(git:*), Bash(gh:*), Bash(grep:*), Bash(make:*), Bash(pnpm:*), Read, Edit, Grep, Glob
---

# Update Changelog

Maintains `CHANGELOG.md` (Keep a Changelog format, semver) by reconciling it against git tags, merged PRs, and actual code diffs.

## Format conventions (this repo)

- Header: `## [X.Y.Z] - YYYY-MM-DD` for released versions, `## [Unreleased]` at the top.
- Section order: **Added**, **Changed**, **Fixed**, **Deprecated**, **Removed**, **Security**. Omit empty sections.
- Bullets describe **user-facing impact** (what an event organizer, attendee, or admin sees), not internal refactors. Drop pure CI/test/lint/type-fix commits unless they change observable behavior.
- Major features get a bold prefix: `- **Discount codes**: full admin CRUD…`. Optional nested sub-bullets for sub-features.
- Bug fixes name the symptom that was fixed, not the patch ("Tier prices no longer get corrupted on save under non-English browser locales").
- Backticks for code symbols: routes (`/org/[slug]/admin/financials`), component names, prop/flag names (`is_open_ended`, `max_tickets_per_user`), env vars (`PUBLIC_API_URL`).
- Dates are the **tag date** (committer date of the tag), not today's date.
- A version with no user-facing change still gets a header followed by:
  `_Maintenance release — internal, tooling, or dependency changes only._`

## Release model (this repo)

- The frontend mirrors the backend: `v`-prefixed semver tags, version in **`package.json`** (not `pyproject.toml`), released via `make release`.
- A "bump X.Y.Z" commit (often bundled with small fixes) lands on `main`, *then* the tag is pushed and the release created.
- **CHANGELOG.md should be updated in the same commit that bumps `package.json`** — write the new `## [X.Y.Z] - YYYY-MM-DD` section before the bump is merged.

## ⚠️ Repo-specific gotchas

- **Always pass `-c log.showSignature=false` to git** (e.g. `git -c log.showSignature=false log …`). Commits are GPG-signed and signature-verification noise otherwise floods every `git log`/`git show`.
- **Mixed merge styles.** Early history uses real merge commits; recent history uses **squash merges** with the PR number in the subject (`feat(x): … (#498)`). So gather commits with `--first-parent` on the full commit list — do **not** rely on `--merges` (it misses every squash merge).
- **API-client noise.** Most feature commits bundle a large regeneration of `src/lib/api/` (`pnpm generate:api` output — `sdk.gen.ts`, `types.gen.ts`, etc.). This is plumbing — drop it unless it surfaces a new user-visible field/flow.
- **Real version gaps exist** and are expected (e.g. `v1.3.2`, `v1.13.6`, `v1.20.0`, the whole `v1.24.x` line were never tagged). Don't invent sections for them.

## Workflow

### 1. Establish state

```bash
git tag --sort=-v:refname | head -20             # latest tags
grep -E '^## \[' CHANGELOG.md | head -10         # versions present in changelog
grep '"version"' package.json | head -1          # pending version
```

Compare the three. Common situations:

- **Behind on tags** — CHANGELOG missing released versions → backfill each gap (step 2 per gap).
- **`[Unreleased]` populated, package.json bumped** — promote `[Unreleased]` to `## [X.Y.Z] - <tag-date>` and start a fresh empty `[Unreleased]`.
- **New work since last tag** — add entries to `[Unreleased]` only.

### 2. Gather changes between two refs

For each version gap `vA..vB` (or `vLast..origin/main` for unreleased):

```bash
# 1. Tag date for the section header
git -c log.showSignature=false log -1 --format=%cs vB        # YYYY-MM-DD

# 2. Commits in the range, first-parent (catches both merge commits AND squash merges)
git -c log.showSignature=false log vA..vB --first-parent --format='%h %s'

# 3. For each non-trivial PR, read its body for the user-facing description
gh pr view <number> --json title,body,labels
```

Group commits by prefix (`feat:`, `fix:`, `refactor:`, `chore:`, `test:`, `docs:`, `ci:`, `style:`) as a first pass — but do not trust the prefix alone (see step 3).

### 3. Verify impact from the diff

A commit message says *what the author intended*; the diff says *what actually changed*. For any entry where impact is unclear or the message is terse:

```bash
git -c log.showSignature=false show <sha> --stat            # which files moved
git -c log.showSignature=false show <sha> -- <interesting-path>
git -c log.showSignature=false diff vA..vB -- src/routes/   # cumulative for an area
```

Verify the user-facing surface:

- New pages / routes → check `src/routes/` (and route groups `(public)`, `(auth)`).
- New components / flows → check `src/lib/components/`.
- i18n → check `messages/*.json` / Paraglide sources (new languages, large string migrations).
- Settings/flags exposed in UI → check the relevant form components and `src/lib/api/` field additions.
- Auth/permissions → check `hooks.server.ts`, guards, eligibility logic.

If the diff is purely internal (API-client regen, renames, helper extraction, type hints, test reorg, file-length splits, dependency bumps) and there is no observable change, **drop it** — even if the commit was `feat:`-prefixed.

### 4. Categorize

| Section | Use for |
|---------|---------|
| **Added** | New pages/routes, new user-facing components/features, new flows (RSVP, checkout, check-in), new i18n languages, new settings/toggles |
| **Changed** | Behavior/UX changes to existing features, redesigns, copy changes with impact, performance visible to users |
| **Fixed** | Bug fixes — describe the symptom the user saw |
| **Deprecated** | Features still working but slated for removal |
| **Removed** | Removed pages, features, options |
| **Security** | Auth fixes, permission tightenings, XSS/sanitization, CSP fixes with user impact |

Bundle related commits into one bullet. A feature that spans several PRs becomes one bold-prefixed bullet, optionally with sub-bullets per sub-feature.

### 5. Write entries

Style examples lifted from this repo's existing entries — match the voice:

```markdown
### Added
- **Discount codes**: full admin CRUD under org admin — list page with search, status/type filters, and inline enable/disable; create/edit pages; scope assignment across series, events, and tiers.
- Image cropper modal when uploading a profile picture, letting you crop before saving.

### Fixed
- Tier prices no longer get corrupted on save under non-English browser locales (e.g. `33.33` becoming `33.31`).
- Returning users with "Remember Me" enabled are no longer shown as logged out after their access token expires.
```

Rules:

- Lead with the *what*, not the *how*.
- Backticks for code symbols (routes, component names, props, env vars).
- Bold prefix `**Name**:` only for headline features that warrant top-billing.
- One sentence per bullet; sub-bullets for multi-part features.
- No author/PR-number/issue-number references — those live in commit history and PRs.

### 6. Insert into the file

- `[Unreleased]` always stays at the top, even if empty (with no subsections), so future entries have a home.
- New released sections go directly under `[Unreleased]`, in descending version order.
- When promoting `[Unreleased]` to a version: copy the content under a new `## [X.Y.Z] - <tag-date>` heading and leave `[Unreleased]` empty.
- Preserve any existing `[Unreleased]` entries — they may already document work in the new version.
- The `## [0.x] — Initial development …` summary stays pinned at the bottom; do not expand it into per-tag sections.

### 7. Verify

```bash
# Visual diff
git diff CHANGELOG.md

# Every released tag has exactly one section
for t in $(git tag | grep -E '^v1\.' | sed 's/^v//'); do
  grep -qE "^## \[$t\] " CHANGELOG.md || echo "MISSING: $t"
done

# Section dates equal tag commit dates
grep -oE '^## \[1\.[0-9.]+\] - [0-9-]+' CHANGELOG.md | sed -E 's/## \[(.*)\] - (.*)/\1 \2/' | while read v d; do
  td=$(git -c log.showSignature=false log -1 --format='%cs' "v$v" 2>/dev/null)
  [ "$d" = "$td" ] || echo "MISMATCH $v: changelog=$d tag=$td"
done
```

Do not run `make release` or push tags — the skill only edits `CHANGELOG.md`. The user runs `make release` themselves.

## Anti-patterns

- ❌ Dumping every commit subject as a bullet. Filter, group, rewrite.
- ❌ Using the date of editing as the section date — use the **tag's commit date**.
- ❌ Relying on `--merges` (misses squash-merged PRs) or trusting `feat:`/`fix:` prefixes without checking the diff.
- ❌ Forgetting `-c log.showSignature=false` and drowning in GPG noise.
- ❌ Listing API-client regen, test additions, type fixes, file-length splits, or CI changes unless they affect users.
- ❌ Inventing impact you can't confirm from the diff. If unsure, ask the user or omit.
- ❌ Overwriting existing `[Unreleased]` content when promoting it — merge, don't replace.
- ❌ Editing `package.json` or creating tags. Out of scope for this skill.
