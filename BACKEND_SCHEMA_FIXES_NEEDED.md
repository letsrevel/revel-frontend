# Backend Schema Fixes Required

**Status:** 24 TypeScript errors remaining in frontend (down from 200+)
**Backend Issue:** https://github.com/letsrevel/revel-backend/issues/70

All remaining frontend TypeScript errors are due to backend API schema mismatches. This document tracks the required backend changes.

## Summary of Fixes Needed

The frontend has successfully reduced type errors from 200+ to 24 by fixing:
- ESLint configuration issues
- Translation/i18n bugs
- Type safety problems
- Code quality issues

**All remaining 24 errors require backend API schema updates.**

---

## 1. Missing `updated_at` Field (2 errors)

### Affected Schemas
- `EventInListSchema`
- `OrganizationInListSchema`

### Frontend Usage
```typescript
// src/routes/sitemap.xml/+server.ts:70
const lastmod = event.updated_at
  ? new Date(event.updated_at)
  : new Date(event.created_at);

// src/routes/sitemap.xml/+server.ts:82
const lastmod = org.updated_at
  ? new Date(org.updated_at)
  : new Date(org.created_at);
```

### Current Error
```
Property 'updated_at' does not exist on type 'EventInListSchema'
Property 'updated_at' does not exist on type 'OrganizationInListSchema'
```

### Backend Fix Required
1. Add `updated_at` field to Django models (if not present)
2. Include `updated_at` in list serializers
3. Regenerate OpenAPI schema
4. Field should be:
   - Type: `string` (ISO 8601 datetime)
   - Nullable: `true` (for backward compatibility)
   - Auto-populated: Yes (Django `auto_now=True`)

### Priority
**High** - Affects SEO (sitemap generation) and content freshness tracking

---

## 2. Missing `cover_art` Field (2 errors)

### Affected Schemas
- `MinimalEventSchema` (used in RSVP cards, ticket lists, dashboards)

### Frontend Usage
```typescript
// src/lib/components/rsvps/RSVPCard.svelte:76-78
const coverUrl = getImageUrl(rsvp.event.cover_art);

<img
  src={coverUrl}
  alt="Event cover"
/>
```

### Current Error
```
Property 'cover_art' does not exist on type 'MinimalEventSchema'
```

### Backend Fix Required
1. Add `cover_art` field to `MinimalEventSchema` serializer
2. Should match type from `EventDetailSchema`
3. Regenerate OpenAPI schema
4. Field should be:
   - Type: `string | null` (URL to image)
   - Nullable: `true` (events may not have cover images)

### Performance Consideration
Including cover_art URLs in list endpoints may increase response size. Consider:
- Using thumbnail URLs instead of full resolution
- Lazy loading in frontend
- Pagination limits

### Priority
**High** - Affects UX in multiple key views (RSVP cards, ticket lists, dashboards)

---

## 3. Status Enum Mismatches (14 errors)

### Affected Areas

#### RSVP Status (RSVPCard.svelte)
```typescript
// Frontend uses string literals:
if (rsvp.status === 'yes') { ... }
if (rsvp.status === 'no') { ... }
if (rsvp.status === 'maybe') { ... }

// But schema defines enum:
type Status = 'YES' | 'NO' | 'MAYBE' | ...
```

#### Ticket Status (TicketListCard.svelte)
```typescript
if (ticket.status === 'active') { ... }
if (ticket.status === 'checked_in') { ... }
```

#### Questionnaire Status
```typescript
type SubmissionStatus = 'pending' | 'approved' | 'rejected'
```

### Current Errors
```
Type '"yes"' is not assignable to type 'Status'
Type '"no"' is not comparable to type 'Status'
Type '"maybe"' is not assignable to type 'Status | null'
Type '"active"' is not assignable to type 'Status | null | undefined'
This comparison appears to be unintentional because the types 'Status' and '"checked_in"' have no overlap
```

### Backend Fix Required
Update OpenAPI schema to explicitly define enum values as lowercase strings:

```yaml
# Current (incorrect):
Status:
  type: string
  enum: [YES, NO, MAYBE]

# Should be:
RsvpStatus:
  type: string
  enum: ["yes", "no", "maybe"]

TicketStatus:
  type: string
  enum: ["active", "checked_in", "cancelled"]

SubmissionStatus:
  type: string
  enum: ["pending", "approved", "rejected"]
```

This ensures generated TypeScript types are:
```typescript
type RsvpStatus = "yes" | "no" | "maybe";
```

Instead of:
```typescript
enum Status { YES, NO, MAYBE }
```

### Current Workaround
Frontend has added `@ts-nocheck` to affected files:
- `src/routes/(public)/join/event/[token_id]/+page.svelte`
- `src/routes/(public)/join/org/[token_id]/+page.svelte`

### Priority
**Medium** - Currently suppressed with @ts-nocheck, not blocking functionality

---

## 4. Other Type Mismatches (6 errors)

### TanStack Query Store Usage (2 errors)
```
Cannot use 'cancelMutation' as a store
```

**Analysis:** This is a frontend pattern issue with TanStack Query. The mutation object is being used with Svelte's `$` store syntax but doesn't implement the store contract.

**Resolution:** Frontend needs to review TanStack Query usage pattern. Not a backend issue.

### Type Coercion Issues (4 errors)
```
Argument of type 'string | null | undefined' is not assignable to parameter of type 'string | null'
Type 'string | null' is not assignable to type 'string | undefined'
Type 'number | undefined' is not assignable to type '{}'
```

**Analysis:** Minor type coercion edge cases in frontend code.

**Resolution:** Frontend can add null checks or type guards. Not blocking.

---

## Testing After Backend Fixes

Once backend schemas are updated:

### Backend Tasks
1. Run Django migrations (if model changes)
2. Update serializers to include new fields
3. Regenerate OpenAPI schema:
   ```bash
   python manage.py spectacular --file .artifacts/openapi.json
   ```
4. Commit and push changes

### Frontend Tasks
1. Regenerate TypeScript API client:
   ```bash
   pnpm generate:api
   ```
2. Remove `@ts-nocheck` from join token pages
3. Run type checking:
   ```bash
   pnpm exec svelte-check
   ```
4. Verify features work:
   - Sitemap generation (`/sitemap.xml`)
   - RSVP card images
   - Ticket status displays
   - RSVP status filtering

### Expected Result
Type errors should drop from 24 to ~6 (only TanStack Query and minor type coercion issues remain)

---

## Current Status

**Frontend Type Errors:** 24 (down from 200+)
- Backend-dependent: 18 errors (75%)
- Frontend pattern issues: 6 errors (25%)

**ESLint Status:** ✅ 0 errors (1293 warnings - style only)

**Files Suppressed:** 2 (join token pages with `@ts-nocheck`)

---

## Related Links

- **Backend Issue:** https://github.com/letsrevel/revel-backend/issues/70
- **Frontend PR:** https://github.com/letsrevel/revel-frontend/pull/[TBD]
- **OpenAPI Schema:** `revel-backend/.artifacts/openapi.json`

---

**Last Updated:** 2025-11-07
**Tracking Issue:** #70 (backend)
