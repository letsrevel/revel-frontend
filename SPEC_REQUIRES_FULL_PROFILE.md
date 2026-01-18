# Feature Spec: Requires Full Profile Gate

## Overview

Events can now require attendees to have a complete profile (profile picture, name, and pronouns) before they can RSVP or purchase tickets. This document describes the backend changes and what the frontend needs to implement.

---

## Backend Changes Summary

### 1. New Event Field

**Field:** `requires_full_profile: boolean` (default: `false`)

This field is now available on:
- `EventBaseSchema` (read responses)
- `EventEditSchema` (create/update requests)

### 2. New Eligibility Gate

When `event.requires_full_profile === true`, the eligibility check verifies the user has:
- A profile picture (`profile_picture`)
- Pronouns (`pronouns`)
- A name (at least one of: `first_name`, `last_name`, or `preferred_name`)

### 3. New Eligibility Response Fields

The `EventUserEligibility` response now includes:

```typescript
interface EventUserEligibility {
  allowed: boolean;
  event_id: string;
  reason?: string;
  next_step?: NextStep;
  // ... existing fields ...
  missing_profile_fields?: string[];  // NEW: ["profile_picture", "pronouns", "name"]
}
```

### 4. New Enum Values

**NextStep:**
```typescript
type NextStep =
  | "purchase_ticket"
  | "rsvp"
  | "fill_questionnaire"
  | "wait_for_questionnaire_review"
  | "join_organization"
  | "request_invitation"
  | "wait_for_invitation"
  | "join_waitlist"
  | "upgrade_membership"
  | "request_whitelist"
  | "wait_for_whitelist_approval"
  | "complete_profile";  // NEW
```

**Reasons:**
```typescript
// New reason string
"Requires full profile."
```

### 5. RSVP Status Change Behavior

Users who have already RSVP'd **YES** can always change their status to MAYBE or NO, even if they no longer meet the `requires_full_profile` requirement. This prevents users from being "trapped" if event requirements change after they've committed to attending.

- User with YES RSVP → Can change to MAYBE/NO (eligibility bypassed)
- User with MAYBE/NO RSVP → Must meet requirements to change to YES

---

## Frontend Implementation Requirements

### 1. Event Admin: Add Toggle for `requires_full_profile`

**Location:** Event create/edit form

**UI:** Add a toggle/checkbox for "Require full profile"

**Behavior:**
- When enabled, attendees must complete their profile before RSVPing/purchasing tickets
- Consider grouping with other "requirements" settings (questionnaire, membership, etc.)

**Suggested label:** "Require complete profile (photo, name, pronouns)"

---

### 2. Event Detail Page: Handle `complete_profile` Next Step

**Location:** Event detail page, eligibility/CTA section

**When:** `eligibility.next_step === "complete_profile"`

**Display:**
- Show a message explaining the user needs to complete their profile
- List the missing fields from `eligibility.missing_profile_fields`:
  - `"profile_picture"` → "Profile picture"
  - `"pronouns"` → "Pronouns"
  - `"name"` → "Display name"
- Provide a CTA button to navigate to the profile settings page

**Example UI:**
```
┌─────────────────────────────────────────────────┐
│  Complete Your Profile                          │
│                                                 │
│  This event requires a complete profile.        │
│  Please add the following:                      │
│                                                 │
│  • Profile picture                              │
│  • Pronouns                                     │
│                                                 │
│  [Complete Profile]                             │
└─────────────────────────────────────────────────┘
```

---

### 3. Profile Page: Ensure Required Fields Are Editable

Ensure users can easily update:
- Profile picture (upload)
- Pronouns (text input or dropdown)
- Name (preferred_name, first_name, or last_name)

Consider adding visual indicators for incomplete fields when the user arrived from an event that requires full profile (could use URL params or state).

---

### 4. My Status Endpoint Behavior

The `/events/{event_id}/my-status` endpoint behavior:

| User State | Response Type | Notes |
|------------|---------------|-------|
| Has tickets | `EventUserStatusResponse` | Includes ticket list |
| Has RSVP (any status) | `EventUserStatusResponse` | Includes RSVP info |
| No interaction | `EventUserEligibility` | Shows what's needed |

When a user has RSVP'd MAYBE and tries to change to YES but doesn't meet `requires_full_profile`:
- The RSVP endpoint will return a 4xx error with `EventUserEligibility` containing `missing_profile_fields`

---

## API Examples

### Eligibility Check Response (blocked by profile requirement)

```json
{
  "allowed": false,
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "reason": "Requires full profile.",
  "next_step": "complete_profile",
  "missing_profile_fields": ["profile_picture", "pronouns"]
}
```

### Event Schema (with new field)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Community Meetup",
  "requires_ticket": false,
  "requires_full_profile": true,
  // ... other fields
}
```

---

## Testing Scenarios

1. **Event admin enables `requires_full_profile`** → Toggle should save correctly
2. **User without complete profile views event** → Should see "Complete Profile" CTA
3. **User completes profile and returns** → Should now be able to RSVP/purchase
4. **User with YES RSVP, event adds requirement** → User can still change to MAYBE/NO
5. **User with MAYBE RSVP, event adds requirement** → User cannot change to YES until profile complete

---

## Related Files (Backend)

- `src/events/models/event.py` - New field
- `src/events/schema/event.py` - Schema updates
- `src/events/service/event_manager/gates.py` - `FullProfileGate` implementation
- `src/events/service/event_manager/types.py` - `missing_profile_fields` field
- `src/events/service/event_manager/enums.py` - New enum values
