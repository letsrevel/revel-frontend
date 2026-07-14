---
description: Cut a release — reconcile CHANGELOG, bump version, open a release/vX.Y.Z PR
argument-hint: "[major|minor|patch]"
---

Drive the local half of a release. On merge of the PR you open, `.github/workflows/release.yaml`
creates the tag and GitHub release automatically. **Never create tags or releases yourself** —
your job ends at opening the PR.

Bump level requested (may be empty): $ARGUMENTS

## Steps

1. **Pre-flight.** Run `git fetch origin` and ensure the working tree is clean and `main` is
   up to date (`git status`, `git rev-parse HEAD origin/main`). If dirty or behind, stop and
   tell the user. Stay on `main` for now.

2. **Reconcile the CHANGELOG first — never trust a stale `[Unreleased]`.** Invoke the
   `update-changelog` skill via the Skill tool to bring `## [Unreleased]` in line with the
   merged PRs/commits since the latest tag. Do not edit `package.json` or create tags here.

3. **Determine the bump level.**
   - If `$ARGUMENTS` is `major`, `minor`, or `patch`, use it.
   - Otherwise infer from the now-accurate `[Unreleased]` section:
     a `Breaking`/`Removed` entry → **major**; an `Added`/`Changed` entry → **minor**;
     only `Fixed`/`Security` → **patch**. State your reasoning, propose the level, and
     **ask the user to confirm before bumping**.

4. **Compute the next version** from the current `package.json` version and the chosen part
   (`X.Y.Z`). The actual write happens in step 6.

5. **Cut the branch:** `git checkout -b release/vX.Y.Z` off the up-to-date `main`.

6. **Bump:** `pnpm version --no-git-tag-version <part>` (writes `package.json`; supports
   `major`, unlike the `make bump-version`/`bump-minor` targets). This does not create a tag
   or commit. Never hand-edit the version.

7. **Promote the CHANGELOG:** rename `## [Unreleased]` to `## [X.Y.Z] - <today's date, YYYY-MM-DD>`
   and insert a fresh empty `## [Unreleased]` above it (preserve the link/section order
   conventions already in the file).

8. **Commit** the bump + changelog together (include `pnpm-lock.yaml` only if it changed):
   `git add package.json CHANGELOG.md && git commit -m "chore(release): vX.Y.Z"`.

9. **Push and open the PR:**
   `git push -u origin release/vX.Y.Z`
   then write the new `## [X.Y.Z]` CHANGELOG section to a temporary file
   (e.g. `BODY=$(mktemp)`), pass it via
   `gh pr create --base main --head release/vX.Y.Z --title "chore(release): vX.Y.Z" --body-file "$BODY"`,
   then remove it (`rm -f "$BODY"`).
   The PR body is a review copy only — on merge the workflow re-extracts the section from the
   merged `CHANGELOG.md` as the canonical release notes. Print the PR URL.

10. **Run the full e2e suite locally before merging.** There is no CI e2e gate (deliberate:
    GH runners take 40+ min for a suite that runs in ~6 locally — see the 2026-07-14 CI-wiring
    spec outcome). Ask the user to run `pnpm test:e2e` against their local stack (backend via
    `make run-e2e`, env contract in `tests/e2e/README.md`), with the backend checkout at (or
    release-equivalent to) the latest released backend — release-first discipline: if this FE
    release needs unreleased backend changes, cut the backend release first. Do NOT merge a
    release PR with a red suite.

## Notes
- Tag/release name is always `vX.Y.Z` (required by `publish.yaml`); the branch is
  `release/vX.Y.Z`; the PR title / squash commit is `chore(release): vX.Y.Z`.
- `make release` remains the manual fallback and is unaffected by this command.
