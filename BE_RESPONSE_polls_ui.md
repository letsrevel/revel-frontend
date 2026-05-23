# Backend response to `FE_ASKS_polls_ui.md`

**Date:** 2026-05-23
**Source:** `revel-backend@feature/445-polls` (PR #446)
**Generated against:** `revel-backend/.artifacts/openapi.json` (regenerate FE client via `pnpm generate:api`).

All three asks landed. Summary, then per-ask detail.

| Ask | Status | Action required on FE |
|---|---|---|
| 1. Embed `QuestionnaireSchema` in poll detail | ✅ Done | Regenerate TS client; update `PollVoteForm.svelte` prop type |
| 2. Seed second `MembershipTier` per org | ✅ Done (Alpha only) | Re-run `make run-demo`; C7 case now exercisable |
| 3. 403 vs 404 for ineligible viewers | ✅ Done (detail GET only — Option B) | Refactor voter-page gate to branch on status |

---

## 1. Critical — `QuestionnaireSchema` is now embedded in `/api/polls/{poll_id}/`

`PollDetailSchema.questionnaire` now resolves to `QuestionnaireSchema` (the same schema returned by `/api/events/{event_id}/questionnaire/{questionnaire_id}`), with the underscored field names:

```json
{
  "questionnaire": {
    "id": "...",
    "name": "...",
    "description": null,
    "evaluation_mode": "manual",
    "multiple_choice_questions": [...],
    "free_text_questions": [...],
    "file_upload_questions": [...],
    "sections": [
      {
        "id": "...",
        "name": "...",
        "order": 0,
        "multiple_choice_questions": [...],
        "free_text_questions": [...],
        "file_upload_questions": [...],
        "depends_on_option_id": null
      }
    ]
  }
}
```

Implementation note: under the hood the controller now calls
`QuestionnaireService(poll.questionnaire_id).build()` to produce the schema —
the exact same code path used by the event questionnaire endpoint, so shuffle
behaviour (`shuffle_questions` / `shuffle_sections` / `shuffle_options`) is
also honoured identically.

The endpoints that embed the questionnaire are:

- `GET /api/polls/{poll_id}/` — only this one.
- `GET /api/polls/organizations/{organization_id}` — does not exist; list endpoint is `GET /api/polls/` with `?organization_id=...` and returns `PollListItemSchema` which does NOT embed the questionnaire (only `questionnaire_name: str`).

### FE follow-ups (verbatim from the ask)

- Run `pnpm generate:api` so the TS client picks up `QuestionnaireSchema`.
- Update `PollVoteForm.svelte:31` prop type from `QuestionnaireResponseSchema` to `QuestionnaireSchema`.
- The `flattenQuestionnaire` util should now work as-is.

---

## 2. Medium — Second `MembershipTier` seeded for Alpha

`bootstrap_helpers/organizations.py` now creates a second tier on the Alpha org
(`"Founders"`) and assigns the multi-org user to it instead of "General membership".

After re-running `make run-demo` (or wiping the DB and re-bootstrapping):

| User | Email | Alpha tier |
|---|---|---|
| Charlie | `charlie.member@example.com` | `General membership` |
| Karen | `karen.multiorg@example.com` | `Founders` |

C7 case ("member NOT on chosen tier is ineligible") can now be exercised:
create a poll with `vote_visibility=MEMBERS_ONLY` and `vote_membership_tier_ids=[<General membership id>]` — Karen will be excluded, Charlie included.

I did **not** add a second tier to Beta — the FE doc marked it optional and the
cross-org case wasn't in your immediate test plan. Ping me if you want
symmetry there.

Verify:
```bash
make run-demo
python src/manage.py shell -c "
from events.models import MembershipTier
print(sorted(MembershipTier.objects.filter(organization__slug='revel-events-collective').values_list('name', flat=True)))
"
# Expected: ['Founders', 'General membership']
```

---

## 3. Optional — Option B (403 vs 404) implemented for the detail endpoint

Per your default preference, `GET /api/polls/{poll_id}/` now distinguishes:

- **`404 Not Found`** — the poll genuinely does not exist.
- **`403 Forbidden`** — the poll exists but the caller is not in any audience
  that may see it (`vote_visibility` AND `result_visibility` both fail, and
  the caller has not voted on it).
- **`200 OK`** — the caller can at least see the poll (`PollDetailSchema`
  with per-user flags `user_can_vote` / `user_can_see_results` / `user_has_voted`).

The branching point is `polls.service.eligibility.can_see_poll`. List
endpoint behaviour is unchanged (visibility-filtered — invisible polls
simply don't appear).

### Scope notes

- I did **not** change `GET /api/polls/{poll_id}/results` — it still returns
  404 if you can't see the poll at all, and 403 if you can see the poll but
  results timing/audience blocks you. Your smoke plan didn't flag the results
  URL directly. Easy to align if you want it.
- Write endpoints (patch/open/close/reopen/delete/vote) are unaffected: they
  retain the visibility-filtered queryset and rely on the per-route
  permission classes for write authority. Vote/withdraw still surface
  service-layer eligibility errors as 403 via the per-app exception handlers
  (no change there).

### FE wiring suggestion

```ts
const res = await api.polls.getPoll(pollId);
if (res.status === 404) return notFound();           // hard 404 page
if (res.status === 403) return renderIneligibleBanner(pollId);
// 200 → render detail; use res.data.user_can_vote etc. for inline banners
```

The 403 response body is a plain ninja error (`{"detail": "You are not
allowed to see this poll."}`) — no structured `reason` payload yet. If you
need machine-readable reasons later (e.g., to render different banners for
"needs membership" vs "needs invitation"), let me know and we can extend
the response shape.

---

## Out of scope (still owned by FE)

Per the original ask:

- Access token serialized into SSR HTML.
- `PollPrivacySummary` row-visibility regression for `timing=never`.
- Reopen modal silent 422 surfacing.
- PollCard heading semantics.
- Voter-form / sync-helper refactor to dedupe with the questionnaire flow.

---

## How to verify everything

```bash
# 1. Regenerate the client.
cd revel-frontend
pnpm generate:api

# 2. Spot-check the wire format.
curl -s -b "$COOKIE_JAR" http://localhost:8000/api/polls/<poll_id>/ \
  | jq '.questionnaire | keys'
# Expected: ["description","evaluation_mode","file_upload_questions",
#            "free_text_questions","id","multiple_choice_questions",
#            "name","sections"]

# 3. 403 vs 404 distinction.
curl -s -o /dev/null -w "%{http_code}\n" -b "$COOKIE_JAR" \
  http://localhost:8000/api/polls/00000000-0000-0000-0000-000000000000/
# Expected: 404 (no such poll)

curl -s -o /dev/null -w "%{http_code}\n" -b "$COOKIE_JAR" \
  http://localhost:8000/api/polls/<members-only-poll-id>/
# Expected: 403 when caller is not a member (was 404)

# 4. Second tier exists.
python src/manage.py shell -c "
from events.models import MembershipTier, OrganizationMember
print(list(MembershipTier.objects.filter(
    organization__slug='revel-events-collective'
).values_list('name', flat=True)))
"
# Expected: contains both 'General membership' and 'Founders'
```
