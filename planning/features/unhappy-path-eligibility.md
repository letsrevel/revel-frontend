# Unhappy Path Eligibility Messaging - Implementation Plan

**Issue:** [#112](https://github.com/letsrevel/revel-frontend/issues/112)
**Status:** 🚧 In Progress
**Started:** 2025-10-23
**Estimated Completion:** 2025-10-25

## Overview

Implement comprehensive, actionable messaging for users who are not eligible to RSVP or purchase tickets for events, based on the backend's `EventUserEligibility` response.

## Backend Schema

```typescript
interface EventUserEligibility {
  allowed: boolean; // false for unhappy paths
  event_id: string; // UUID
  reason: string | null; // Human-readable message
  next_step: NextStep | null; // Action to take
  questionnaires_missing: string[] | null; // UUIDs
  questionnaires_pending_review: string[] | null; // UUIDs
  questionnaires_failed: string[] | null; // UUIDs
  retry_on: string | null; // ISO datetime
}

enum NextStep {
  REQUEST_INVITATION = "request_invitation",
  BECOME_MEMBER = "become_member",
  COMPLETE_QUESTIONNAIRE = "complete_questionnaire",
  WAIT_FOR_QUESTIONNAIRE_EVALUATION = "wait_for_questionnaire_evaluation",
  WAIT_TO_RETAKE_QUESTIONNAIRE = "wait_to_retake_questionnaire",
  WAIT_FOR_EVENT_TO_OPEN = "wait_for_event_to_open",
  JOIN_WAITLIST = "join_waitlist",
  PURCHASE_TICKET = "purchase_ticket",
  RSVP = "rsvp"
}
```

## Implementation Phases

### Phase 1: Core Messaging Components ✅

**Status:** ✅ Completed
**Estimated:** 4-6 hours
**Actual:** ~4 hours
**Completed:** 2025-10-23

#### Tasks

- [x] Create `src/lib/components/events/IneligibilityMessage.svelte`
  - Display reason, icon, and descriptive message
  - Show questionnaire lists (missing, pending, failed)
  - Mobile-responsive layout
  - WCAG 2.1 AA compliant

- [x] Create `src/lib/components/events/RetryCountdown.svelte`
  - Accept `retryOn` ISO datetime
  - Display live countdown (updates every second)
  - Format output based on time remaining
  - Handle edge cases (past dates, invalid dates)

- [x] Create `src/lib/components/events/IneligibilityActionButton.svelte`
  - Render correct button text/icon per `next_step`
  - Handle disabled states
  - Navigation for `become_member`, `complete_questionnaire`
  - Stub handlers for API actions (console.log for now)

- [x] Integrate into `EventRSVP.svelte`
  - Replace existing ineligible message block
  - Pass required props to `IneligibilityMessage`
  - Removed old helper functions
  - Cleaned up unused imports

#### Acceptance Criteria

- [x] All 10 `next_step` states display correct message
- [x] Icons are appropriate and accessible (`aria-hidden="true"`)
- [x] Retry countdown updates every second
- [x] Mobile layout is clean (single column, stacked)
- [x] Questionnaire lists render correctly
- [x] Keyboard navigation works (native button/link elements)
- [x] Screen reader announces ineligibility messages (`role="status"`, `aria-live="polite"`)
- [x] Type checking passes
- [x] Code formatted with Prettier

#### Notes

- Utilities already exist in `src/lib/utils/eligibility.ts` - no new utility file needed
- Components use existing shadcn-svelte Button component
- Waitlist action shows "Feature coming soon" message (backend in backlog)
- Request invitation action is stubbed (Phase 2 will implement API call)

---

### Phase 2: Action Handlers & API Integration ✅ / ⏳ / ❌

**Status:** ⏳ Pending
**Estimated:** 4-6 hours

#### Tasks

- [ ] Create `src/lib/api/events.ts`
  - `requestEventInvitation(eventId, message?)`
  - Error handling for 400, 401, 403
  - Return structured `{ success, error }` responses

- [ ] Implement `request_invitation` action
  - Wire up API call in `IneligibilityActionButton`
  - Show loading spinner while pending
  - Success state: Green checkmark, "Request sent"
  - Error state: Show error message, allow retry
  - Optimistic UI: Disable button immediately

- [ ] Implement navigation actions
  - `become_member`: Navigate to `/org/{slug}`
  - `complete_questionnaire`: Navigate to `/questionnaires/{id}`
  - Handle multiple questionnaires (link to list)

- [ ] Add success/error UI states
  - Success messages for API actions
  - Error messages with retry buttons
  - Accessible live regions (`aria-live="polite"`)

- [ ] TanStack Query integration
  - Invalidate `['event', eventId, 'status']` after successful actions
  - Optimistic updates for request invitation

#### Acceptance Criteria

- [ ] "Request Invitation" button calls API successfully
- [ ] Success message shows after invitation request
- [ ] Error messages show for API failures
- [ ] "Become Member" navigates to org page
- [ ] "Complete Questionnaire" navigates correctly
- [ ] Multiple questionnaires show list link
- [ ] Loading states work correctly
- [ ] Optimistic UI updates happen immediately

---

### Phase 3: Advanced Features ✅ / ⏳ / ❌

**Status:** ⏳ Pending
**Estimated:** 3-4 hours

#### Tasks

- [ ] Enhanced countdown timer
  - Auto-enable button when countdown reaches zero
  - Show notification: "You can now retry!"
  - Refresh eligibility status automatically
  - Handle timezone edge cases

- [ ] Questionnaire details fetching
  - Fetch questionnaire names by UUID (if endpoint exists)
  - Display user-friendly names instead of UUIDs
  - Handle missing questionnaires gracefully
  - Cache questionnaire metadata

- [ ] Waitlist mock button
  - Show "Join Waitlist" button for `join_waitlist` next_step
  - Display modal: "Waitlist feature coming soon!"
  - Add TODO comment for backend implementation
  - Or: Hide button, show informational message

- [ ] Animations
  - Fade in success messages
  - Loading spinner on buttons
  - Smooth transitions between states

#### Acceptance Criteria

- [ ] Countdown auto-enables button at zero
- [ ] Questionnaire names display (if available)
- [ ] Waitlist shows appropriate placeholder
- [ ] Animations are smooth and accessible
- [ ] E2E test covers request invitation flow

---

### Phase 4: Polish & Edge Cases ✅ / ⏳ / ❌

**Status:** ⏳ Pending
**Estimated:** 2-3 hours

#### Tasks

- [ ] Edge case handling
  - No `next_step` provided: Show generic message
  - Invalid `retry_on` date: Handle gracefully
  - Multiple failed questionnaires: Show all with retry dates
  - Missing questionnaire IDs: Fallback to generic message

- [ ] Mobile optimization
  - Ensure touch targets are 44x44px minimum
  - Test on real devices (iOS, Android)
  - Verify sticky behavior on mobile

- [ ] Accessibility audit
  - Run axe DevTools (0 critical issues)
  - Test with VoiceOver/NVDA
  - Verify keyboard navigation
  - Check color contrast (4.5:1 minimum)
  - Ensure focus indicators are visible

- [ ] Documentation
  - Add JSDoc comments to new components
  - Update this implementation plan with completion status
  - Create usage examples in component comments

#### Acceptance Criteria

- [ ] All edge cases handled gracefully
- [ ] Mobile UX is polished and usable
- [ ] Accessibility audit passes (no critical issues)
- [ ] Documentation is complete
- [ ] All manual testing scenarios pass

---

## Files Created/Modified

### New Files

```
src/lib/components/events/
├── IneligibilityMessage.svelte          (150-200 lines)
├── IneligibilityActionButton.svelte     (200-250 lines)
└── RetryCountdown.svelte                (80-100 lines)

src/lib/utils/
├── ineligibility.ts                     (100-150 lines)
└── datetime.ts                          (extend existing)

src/lib/api/
└── events.ts                            (80-120 lines)
```

### Modified Files

```
src/lib/components/events/
├── EventRSVP.svelte                     (~20 lines changed)
├── ActionButton.svelte                  (~15 lines changed - Phase 2)
└── EventActionSidebar.svelte            (~5 lines changed)
```

---

## API Dependencies

### Ready to Use

- ✅ `POST /api/events/{event_id}/request-invitation`
  - Request Schema: `{ message?: string }`
  - Response: `EventInvitationRequestSchema`
  - Errors: 400 (already requested), 401, 403

### Blocked (Backend in Backlog)

- ⏳ `POST /api/events/{event_id}/waitlist`
  - **Workaround:** Show mock button with "coming soon" message
  - Expected Response: `{ event_id, position, created_at }`

### Optional (Future)

- 🔶 `POST /api/events/{event_id}/notify-me`
  - **Alternative:** Use organization subscription
  - Can be omitted for MVP

---

## Testing Strategy

### Unit Tests

- [ ] `src/lib/utils/ineligibility.test.ts`
  - Icon mapping for each `next_step`
  - Message formatting
  - Edge cases (null values, invalid data)

- [ ] `src/lib/utils/datetime.test.ts`
  - Countdown formatting for various time ranges
  - Past date handling
  - Invalid ISO string handling

### Component Tests

- [ ] `RetryCountdown.test.ts`
  - Updates every second
  - Displays correct format for different time ranges
  - Handles countdown reaching zero

- [ ] `IneligibilityActionButton.test.ts`
  - Calls correct handler for each `next_step`
  - Shows loading state during API call
  - Displays success/error messages

- [ ] `IneligibilityMessage.test.ts`
  - Renders correct message for each state
  - Shows/hides questionnaire lists appropriately
  - Displays retry countdown when `retry_on` is present

### E2E Tests

- [ ] Request invitation flow
  - User sees "Invitation required" message
  - Clicks "Request Invitation"
  - Sees success message
  - Button becomes disabled "Request Sent"

- [ ] Complete questionnaire navigation
  - User sees "Complete questionnaire" message
  - Clicks "Complete Questionnaire"
  - Navigates to questionnaire page

- [ ] Retry countdown
  - User sees countdown for retry
  - Button is disabled
  - Countdown updates

### Accessibility Tests

- [ ] Keyboard navigation to action buttons
- [ ] Screen reader announces ineligibility messages
- [ ] Focus indicators are visible
- [ ] Color contrast meets 4.5:1 minimum
- [ ] `aria-live` regions announce changes

---

## Progress Tracking

### Daily Updates

**2025-10-23:**
- ✅ Created GitHub issue #112
- ✅ Created implementation plan
- ✅ Completed Phase 1: Core messaging components
  - Created `IneligibilityMessage.svelte`
  - Created `RetryCountdown.svelte`
  - Created `IneligibilityActionButton.svelte`
  - Integrated into `EventRSVP.svelte`
  - All type checks passing
  - Ready for Phase 2

**2025-10-24:** (Planned)
- Start Phase 2: Action handlers and API integration
  - Implement request invitation API call
  - Add success/error states
  - TanStack Query integration

**2025-10-25:** (Planned)
- Complete Phase 2
- Complete Phase 3 & 4
- Final testing and PR

---

## Notes & Decisions

### Decision Log

1. **Waitlist Button Strategy**
   - **Decision:** Show mock button that displays "Feature coming soon" modal
   - **Rationale:** Provides clear UX feedback, easy to swap out when backend ready
   - **Alternative Considered:** Hide button entirely (rejected - less clear to users)

2. **Questionnaire Name Fetching**
   - **Decision:** Try to fetch, fallback to "Required questionnaire"
   - **Rationale:** Better UX when available, degrades gracefully
   - **Alternative Considered:** Always show UUID (rejected - poor UX)

3. **Component Structure**
   - **Decision:** Separate `IneligibilityMessage` and `IneligibilityActionButton`
   - **Rationale:** Better separation of concerns, easier testing
   - **Alternative Considered:** Single component (rejected - too complex)

### Known Limitations

- Waitlist functionality mocked (backend in backlog)
- Questionnaire names may show as UUIDs if metadata endpoint missing
- "Notify Me" feature not implemented (future enhancement)

### Future Enhancements

- Email notification signup for event openings
- Confetti animation when user becomes eligible
- Waitlist position tracking and updates
- Admin view of invitation requests

---

## Completion Checklist

- [ ] Phase 1 complete
- [ ] Phase 2 complete
- [ ] Phase 3 complete
- [ ] Phase 4 complete
- [ ] All tests passing
- [ ] Accessibility audit passed
- [ ] PR created and reviewed
- [ ] Documentation updated
- [ ] Issue #112 closed
