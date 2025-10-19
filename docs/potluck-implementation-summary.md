# Potluck Coordination System - Implementation Summary

## Overview

This document summarizes the technical planning for the potluck coordination feature based on issue #27. The feature enables event attendees to coordinate bringing items to events through a seamless, integrated experience in the event detail page.

## GitHub Issues Created

### Main Feature Issue

- **#50** - Feature: Potluck Coordination System
  - Links to all implementation tasks
  - Contains acceptance criteria and success metrics
  - Tracks overall progress

### Implementation Tasks (in order)

1. **#51** - Create core PotluckSection component (8 hours)
   - Foundation component with data fetching
   - TanStack Query integration
   - Polling for real-time updates
   - Loading and error states
   - Mobile collapsible behavior

2. **#52** - Implement potluck item display components (6 hours)
   - PotluckItemsList - grouped by category
   - PotluckItem - individual item cards
   - PotluckCategoryGroup - collapsible categories
   - PotluckEmptyState - no items state
   - Search/filter functionality

3. **#53** - Implement claim/unclaim functionality (4 hours)
   - Claim mutation with optimistic updates
   - Unclaim mutation with optimistic updates
   - Error handling and rollback
   - User notifications (toast)
   - Keyboard accessibility

4. **#54** - Add organizer management UI (6 hours)
   - PotluckItemForm - add/edit component
   - Create, update, delete mutations
   - Form validation with Zod
   - Permission checks
   - Rich text notes editor

5. **#55** - Add mobile-specific enhancements (3 hours)
   - Touch-optimized interactions
   - Swipe gestures
   - Floating Action Button (FAB)
   - Bottom sheet for forms
   - Pull-to-refresh
   - Responsive grid layouts

6. **#56** - Write comprehensive tests (3 hours)
   - Unit tests (Vitest)
   - Integration tests (MSW)
   - E2E tests (Playwright)
   - Accessibility tests (axe-core)
   - Mobile-specific tests
   - > 80% coverage goal

**Total Estimated Effort:** 30 hours

## Technical Architecture

### Integration Point

The potluck section integrates into the existing event detail page:

```
/events/[org_slug]/[event_slug]/+page.svelte
├── EventHeader
├── Main Content (2 columns on desktop)
│   ├── EventDetails
│   ├── PotluckSection ← NEW (conditionally rendered)
│   └── OrganizationInfo (mobile only)
└── Sidebar (desktop only)
    ├── EventActionSidebar
    └── OrganizationInfo
```

### Component Hierarchy

```
PotluckSection/ (root component)
├── PotluckManagementBar (organizers only)
│   └── Add Item button/FAB
├── Search/Filter UI
├── PotluckItemsList
│   ├── PotluckCategoryGroup (per category)
│   │   └── PotluckItem (per item)
│   │       ├── Item details
│   │       ├── Claim/Unclaim button
│   │       └── Edit/Delete buttons (organizers)
│   └── PotluckEmptyState (when no items)
└── PotluckItemForm (modal/inline)
    └── Add/Edit form fields
```

### State Management Strategy

**TanStack Query for Server State:**

- Fetching potluck items
- Mutations for claim/unclaim/create/update/delete
- Optimistic updates with rollback
- Automatic refetching and cache invalidation
- 5-second polling when section is visible

**Svelte Runes for UI State:**

- `$state` for form inputs, modals, search query
- `$derived` for filtered/sorted items
- `$effect` for polling control

### Data Flow

```
1. Server-Side Initial Load
   ├── +page.server.ts fetches event data
   ├── If potluck_open, fetch potluck items
   └── Pass to component as initialData

2. Client-Side Hydration
   ├── TanStack Query initializes with SSR data
   ├── Start polling (5-second interval)
   └── Render UI with initial data (no loading state)

3. User Interactions
   ├── Claim/Unclaim
   │   ├── Optimistic update (immediate UI change)
   │   ├── API call
   │   ├── Success: invalidate query, show success toast
   │   └── Error: rollback, show error toast
   │
   └── Add/Edit/Delete (organizers)
       ├── Optimistic update
       ├── API call
       ├── Success: invalidate query
       └── Error: rollback, show error

4. Real-Time Updates
   └── Polling refetches every 5s when expanded
```

## API Integration

### Available Endpoints

All endpoints auto-generated in the API client:

```typescript
// List items
potluckListPotluckItems7201D243({
	path: { event_id: string }
});

// Create item (organizers)
potluckCreatePotluckItem0665A3B5({
	path: { event_id: string },
	body: PotluckItemCreateSchema
});

// Update item (organizers)
potluckUpdatePotluckItemB48C07E1({
	path: { event_id: string, item_id: string },
	body: PotluckItemCreateSchema
});

// Delete item (organizers)
potluckDeletePotluckItem06D8A8A6({
	path: { event_id: string, item_id: string }
});

// Claim item
potluckClaimPotluckItem2E4F8382({
	path: { event_id: string, item_id: string }
});

// Unclaim item
potluckUnclaimPotluckItem545F1B8E({
	path: { event_id: string, item_id: string }
});
```

### Error Handling

HTTP Status → User-Friendly Message:

- `400` → "This item has already been claimed"
- `401` → "Please log in to perform this action"
- `403` → "You don't have permission to do this"
- `404` → "This item no longer exists"
- `500` → "Something went wrong. Please try again."

## Permission Model

### Attendees

- View all items
- Claim available items
- Unclaim own items
- Search/filter items

### Organizers (event.organization.is_admin OR userStatus.permissions.manage_potluck)

- All attendee permissions
- Add new items
- Edit any items
- Delete any items (even if claimed)

### Not Authenticated

- View items only (read-only)
- See "Login to claim" message

## Accessibility Compliance (WCAG 2.1 AA)

### Semantic HTML

- `<section>` for potluck area
- `<article>` for each item
- `<button>` for all actions
- Proper heading hierarchy

### ARIA

- `aria-live="polite"` for status updates
- `aria-busy` during loading
- `aria-pressed` for toggle states
- `aria-describedby` for help text
- `role="status"` for announcements

### Keyboard Navigation

- Tab through all interactive elements
- Enter/Space to activate buttons
- Escape to close modals
- Arrow keys for category navigation
- Focus management (trap in modals)

### Visual

- Minimum 4.5:1 contrast for text
- Minimum 3:1 for UI components
- Visible focus indicators
- No color-only information

### Screen Reader Support

- Descriptive labels for all buttons
- Live announcements for state changes
- Alternative text for icons
- Proper context for actions

## Mobile UX Design

### Breakpoint Strategy

**Mobile (< 768px):**

- Single column layout
- Collapsible section (accordion)
- Full-width item cards
- Bottom sheet for forms
- FAB for add action
- Larger touch targets (min 44px)
- Swipe gestures (optional)

**Tablet (768px - 1023px):**

- Two column grid
- Side panel for forms
- Hover states enabled
- Reduced FAB size

**Desktop (≥ 1024px):**

- Three column grid
- Inline editing
- Rich tooltips
- All hover interactions

### Touch Interactions

- **Tap** - Select/activate
- **Long press** - Show context menu (organizers)
- **Swipe left** - Quick claim (if unclaimed)
- **Swipe right** - Quick unclaim (if owned)
- **Pull down** - Refresh items
- **Haptic feedback** - On claim/unclaim (if supported)

## Performance Considerations

### Initial Load

- SSR with initial data (no loading spinner)
- Critical CSS inline
- Lazy load form components
- Image optimization (avatars)

### Runtime

- Virtual scrolling for >50 items
- Debounced search (300ms)
- Request animation frame for smooth animations
- Optimistic updates for instant feedback

### Network

- 5-second polling (adjustable)
- Cancel in-flight requests on unmount
- Retry failed requests (exponential backoff)
- Offline support (read-only cached data)

## Testing Strategy

### Test Coverage Goals

- Statements: >80%
- Branches: >75%
- Functions: >80%
- Lines: >80%

### Test Types

1. **Unit Tests** - Component logic, data transformations
2. **Integration Tests** - API interactions, optimistic updates
3. **E2E Tests** - Complete user flows, cross-browser
4. **Accessibility Tests** - axe-core validation, keyboard nav
5. **Mobile Tests** - Touch interactions, responsive layout

## File Structure

```
src/
├── lib/
│   ├── components/
│   │   └── potluck/
│   │       ├── PotluckSection.svelte
│   │       ├── PotluckItemsList.svelte
│   │       ├── PotluckItem.svelte
│   │       ├── PotluckItemForm.svelte
│   │       ├── PotluckCategoryGroup.svelte
│   │       ├── PotluckManagementBar.svelte
│   │       ├── PotluckEmptyState.svelte
│   │       └── index.ts
│   │
│   ├── utils/
│   │   └── potluck.ts (helper functions)
│   │
│   └── stores/
│       └── potluck.ts (if needed for global state)
│
├── routes/
│   └── (public)/
│       └── events/
│           └── [org_slug]/
│               └── [event_slug]/
│                   ├── +page.svelte (integration point)
│                   └── +page.server.ts (SSR data loading)
│
└── tests/
    ├── unit/
    │   └── potluck/
    │       ├── PotluckSection.test.ts
    │       ├── PotluckItem.test.ts
    │       └── ...
    │
    ├── integration/
    │   └── potluck-api.test.ts
    │
    └── e2e/
        └── potluck.spec.ts
```

## Implementation Timeline

Assuming one developer working full-time (8 hours/day):

- **Week 1, Days 1-2:** Task #51 - Core component (8h)
- **Week 1, Day 3:** Task #52 - Display components (6h)
- **Week 1, Day 4:** Task #53 - Claim/unclaim (4h)
- **Week 1, Day 5:** Task #54 - Organizer UI (6h)
- **Week 2, Day 1 (morning):** Task #55 - Mobile enhancements (3h)
- **Week 2, Day 1 (afternoon):** Task #56 - Testing (3h)
- **Week 2, Day 2:** Buffer for bug fixes, polish

**Total:** ~1.5 weeks

## Risks and Mitigations

### Risk: Race Conditions

**Scenario:** Two users claim the same item simultaneously
**Mitigation:** Server-side validation, optimistic update with rollback, clear error messaging

### Risk: Stale Data

**Scenario:** User sees outdated claim status
**Mitigation:** 5-second polling, optimistic updates, manual refresh option

### Risk: Poor Mobile Performance

**Scenario:** Laggy scrolling with many items
**Mitigation:** Virtual scrolling, lazy loading, performance profiling

### Risk: Accessibility Violations

**Scenario:** Screen reader incompatibility
**Mitigation:** Comprehensive testing with axe-core, manual testing with VoiceOver/NVDA

### Risk: Permission Confusion

**Scenario:** Users confused why they can't edit
**Mitigation:** Clear UI indicators, helpful tooltips, permission-based feature gating

## Success Criteria

### Technical

- [ ] All 6 tasks completed and merged
- [ ] Test coverage >80%
- [ ] Zero critical accessibility violations
- [ ] Page load time <2s
- [ ] Claim/unclaim perceived latency <500ms

### User Experience

- [ ] Mobile functionality matches desktop
- [ ] Clear visual feedback for all actions
- [ ] Intuitive permission model
- [ ] Helpful error messages
- [ ] Keyboard accessible

### Business

- [ ] Feature adopted by organizers
- [ ] Low error rate (<1% in production)
- [ ] Positive user feedback
- [ ] Reduced coordination overhead

## Next Steps

1. **Review and approve** this technical specification
2. **Assign tasks** to developers (can be parallelized after #51)
3. **Set up feature flag** for gradual rollout
4. **Begin implementation** with task #51
5. **Weekly check-ins** to track progress
6. **Beta test** with selected organizations
7. **Full release** after successful beta period

## Questions to Answer Before Implementation

1. **Rich text editor:** Which library for notes? (TipTap, Quill, or simple textarea?)
2. **Image uploads:** Should items support images? (Future enhancement?)
3. **Notifications:** Should users get notified when items are claimed/unclaimed?
4. **Polling interval:** Is 5 seconds appropriate, or should it be configurable?
5. **Item limits:** Should there be a max number of items per event?
6. **Claiming limits:** Can users claim multiple items? Is there a limit?
7. **Analytics:** What events should we track for product insights?

## Resources

- **Technical Spec:** `/docs/potluck-technical-spec.md`
- **Main Issue:** GitHub #50
- **Task Issues:** GitHub #51-56
- **API Documentation:** `backend_context/openapi.json`
- **Event Detail Page:** `src/routes/(public)/events/[org_slug]/[event_slug]/+page.svelte`

---

**Document Version:** 1.0
**Created:** 2025-10-19
**Author:** Project Manager AI Agent
**Status:** Ready for Implementation
