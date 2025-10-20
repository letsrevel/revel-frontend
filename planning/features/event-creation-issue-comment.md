# Event Creation & Management - Implementation Plan Complete ✅

## Summary

Comprehensive implementation plan completed for the Event Creation and Editing Wizard. This is a **critical organizer feature** that enables organization owners and staff to create, manage, and publish events.

**📄 Full Plan:** [`planning/features/event-creation-management.md`](../event-creation-management.md) (2,000+ lines)

---

## 🎯 Design Philosophy: Speed First

**Most organizers should create events in under 30 seconds.** The wizard uses a **2-step fast creation flow**:

### Step 1: Essentials (6 fields) ⚡
- Event name
- Start date/time
- City (smart defaults: org city → user preference → manual)
- Visibility (who can VIEW - defaults to "public")
- Type (who can PARTICIPATE - defaults to "public")
- Requires ticket (defaults to false)

**Action:** "Create Event" → Saves as draft, proceeds to Step 2

### Step 2: Details (Optional) 🎨
All additional configuration in **collapsible accordion sections**:
- **Basic:** Description, end date, address
- **Ticketing:** Ticket tiers OR RSVP settings
- **Capacity:** Max attendees, waitlist, invitation message
- **Advanced:** Check-in, potluck, tags (autocomplete), event series, questionnaire
- **Media:** Logo, cover art

**Actions:** "Back" | "Save & Exit"

### Publishing Workflow 🚀
- All events created as **draft** status
- Publishing happens **separately** via status management actions (draft → open)
- No "Create & Publish" button in wizard - keeps flow simple

---

## 🔑 Key Features

### Smart Defaults
- **City:** org.city → `/api/preferences/general` → null
- **Visibility:** `public`
- **Type:** `public`
- **Requires ticket:** `false`

### Advanced Capabilities
- ✅ **Draft auto-save** (3s debounce)
- ✅ **Tag autocomplete** (backend `get_or_create`)
- ✅ **Event series dropdown** (org's existing series)
- ✅ **Questionnaire linking** (org's questionnaires + "Create New" → separate wizard)
- ✅ **Ticket tier management** (CRUD operations)
- ✅ **Image upload** (logo, cover art) with compression
- ✅ **Permission-based access** (owner/staff with `create_event`)
- ✅ **Event editing** (reuses wizard)
- ✅ **Status management** (draft/open/closed/deleted)

### Accessibility & Mobile
- ✅ **WCAG 2.1 AA compliant** (keyboard nav, screen readers, ARIA)
- ✅ **Mobile-first design** (44px touch targets, responsive)
- ✅ **Native date pickers** on mobile

---

## 📊 Effort & Timeline

**Total Estimated Effort:** 18-22 hours (reduced from 24-28 due to simplified 2-step wizard)

**Timeline:** 2-3 weeks (at 8-10 hours/week)

### Implementation Phases

| Phase | Effort | Description |
|-------|--------|-------------|
| 1. Foundation | 7-9h | Admin routes, permissions, form components |
| 2. Wizard | 5-6h | 2-step creation flow (simplified!) |
| 3. Ticket Tiers | 3-4h | Tier editor and CRUD |
| 4. Editing & Management | 4-5h | Event list, edit wizard, status actions |
| 5. Auto-Save | 2-3h | Draft saving/resuming |
| 6. Image Upload | 2-3h | Upload API, preview, compression |
| 7. Polish | 3-4h | Loading states, errors, accessibility |
| 8. Testing | 2-3h | Unit, component, E2E tests |

---

## 🏗️ Technical Architecture

### Routing Structure
```
src/routes/(auth)/org/[slug]/admin/
├── +layout.svelte                   # Admin navigation
├── +layout.server.ts                # Permission checks
├── events/
│   ├── new/+page.svelte             # Creation wizard
│   └── [event_id]/
│       └── edit/+page.svelte        # Edit wizard (reuses creation)
```

### Core Components
- `EventWizard.svelte` - 2-step wizard shell
- `EssentialsStep.svelte` - Step 1 (6 essential fields)
- `DetailsStep.svelte` - Step 2 (accordion sections)
- `TicketTierEditor.svelte` - Ticket tier CRUD
- `TagInput.svelte` - Tag autocomplete
- Reusable: `MarkdownEditor`, `DateTimePicker`, `ImageUploader`

### State Management
- **Svelte 5 Runes** for local wizard state
- **TanStack Query** for server state (org data, drafts)
- **Debounced auto-save** mutation

---

## ✅ Clarifications Resolved

All critical questions answered:

1. **✅ Admin Infrastructure:** Implement minimal `/org/[slug]/admin/` as part of this issue
2. **✅ Visibility vs Type:**
   - **Visibility** = Who can VIEW the event
   - **Type** = Who can PARTICIPATE (RSVP/buy tickets)
   - Example: `visibility: public, type: members-only` = Anyone can see, only members can RSVP
3. **✅ Status Lifecycle:** `draft` → `open` → `closed` / `deleted`
4. **✅ Address:** Single text field (not structured)
5. **✅ Tags:** Custom with autocomplete (backend `get_or_create`)
6. **✅ Event Series:** Dropdown in Step 2 Advanced
7. **✅ Questionnaires:** Dropdown + "Create New" (triggers separate wizard - Issue #TBD)
8. **✅ City Default:** org.city → user pref → null
9. **✅ Publishing:** Draft-first, publish separately (no "Create & Publish" button)
10. **✅ Defaults:** visibility=public, type=public, requires_ticket=false

---

## 🧪 Testing Strategy

### Unit Tests
- Validation functions (dates, prices, permissions)
- Date comparison logic
- Price calculations

### Component Tests
- Wizard navigation
- Form validation
- Tag autocomplete
- Image upload

### E2E Tests (Playwright)
- Complete event creation (Step 1 only)
- Complete event creation (full Step 2)
- Event editing
- Draft saving/resuming
- Ticket tier creation
- Permission enforcement

---

## 📦 Dependencies

### Blocking Dependency (Resolved)
- **Issue #19: Organization Management** - ❌ Not started
  - **Resolution:** Implement **minimal admin infrastructure** as part of this issue
  - Includes: `/org/[slug]/admin/` routes, permission checks, org data loading
  - Full org management features deferred to #19

### New Dependency
- **Issue #TBD: Questionnaire Builder Wizard** - Not started
  - Needed for "Create New" questionnaire option in event wizard
  - Will be created as separate issue

### Optional (Can Defer)
- Issue #67: Advanced Tags System
- Issue #26: Event Series Management (basic dropdown sufficient for MVP)

---

## 🎯 Success Criteria

### Functionality
- [ ] Org owners can create events
- [ ] Staff with `create_event` can create events
- [ ] Validation prevents invalid data
- [ ] City defaults correctly (org → user → null)
- [ ] Visibility defaults to "public"
- [ ] Type defaults to "public"
- [ ] Ticketing defaults to false
- [ ] Drafts auto-save every 3s
- [ ] Can resume drafts
- [ ] Tag autocomplete works
- [ ] Event series dropdown works
- [ ] Questionnaire dropdown works
- [ ] Images upload successfully
- [ ] Events can be edited
- [ ] Status can be updated (draft/open/closed/deleted)

### Accessibility (WCAG 2.1 AA)
- [ ] Passes axe DevTools (0 violations)
- [ ] Full keyboard navigation
- [ ] Screen reader announces progress
- [ ] Form errors announced via aria-live
- [ ] 4.5:1 color contrast

### Performance
- [ ] Wizard loads < 2s
- [ ] Auto-save doesn't block UI
- [ ] Bundle size < 50KB increase

### Mobile
- [ ] Usable at 375px width
- [ ] Touch targets ≥ 44x44px
- [ ] Date pickers work on iOS/Android
- [ ] Camera upload works

---

## 📝 Code Examples Included

The full plan includes production-ready code examples:

1. **EventWizard.svelte** - Complete 2-step wizard shell
2. **EssentialsStep.svelte** - Step 1 component
3. **TicketTierEditor.svelte** - Ticket tier CRUD
4. **Auto-save pattern** - Debounced draft saving
5. **Permission checks** - Server-side layout
6. **Accessibility patterns** - ARIA, keyboard nav
7. **Mobile layouts** - Responsive breakpoints

---

## 🚀 Next Steps

1. ✅ Review implementation plan
2. ✅ Answer all clarification questions
3. ⏳ Create Issue #TBD for Questionnaire Builder Wizard
4. ⏳ Begin Phase 1: Foundation (admin routes, permissions, form components)

---

**📄 Full Documentation:** See [`planning/features/event-creation-management.md`](../event-creation-management.md) for:
- Complete backend API analysis (13 endpoints, schemas, enums)
- Detailed component hierarchy
- State management strategy
- Data flow diagrams
- Accessibility requirements checklist
- Mobile UX requirements
- Complete code examples
- Testing strategy
- Risk analysis

**Estimated Completion:** 2-3 weeks from start

**Status:** ✅ Ready for implementation

---

🤖 *Plan generated with [Claude Code](https://claude.com/claude-code)*
