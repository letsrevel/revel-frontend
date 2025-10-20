# Event Creation & Management - Implementation Plan

**GitHub Issue:** [#20](https://github.com/letsrevel/revel-frontend/issues/20)
**Status:** Planning Complete - Clarifications Resolved
**Created:** 2025-10-20
**Updated:** 2025-10-20
**Estimated Effort:** 18-22 hours (Large - Reduced from 22-26 due to simplified 2-step wizard)
**Priority:** Critical - Core Organizer Feature

---

## Executive Summary

This document provides a comprehensive implementation plan for the Event Creation & Management feature. This is a critical organizer workflow that allows organization owners and staff to create, edit, and manage events for their organizations.

### Key Requirements

- **Fast 2-step creation wizard** - Essential fields first, details later
- **Step 1 (Essentials):** Name, date, city, visibility, type, ticketing toggle (90% of events)
- **Step 2 (Details):** All remaining fields (capacity, potluck, images, etc.)
- Draft saving and resumption
- Event editing and status management
- Permission-based access control
- WCAG 2.1 AA compliant
- Mobile-first responsive design

### Design Philosophy

**Speed First:** Most organizers should be able to create an event in Step 1 alone. Step 2 is for additional configuration and polish.

---

## Backend API Analysis

### Available Endpoints

#### Event Creation & Management

| Endpoint | Method | Purpose | Permission Required |
|----------|--------|---------|---------------------|
| `/api/organization-admin/{slug}/create-event` | POST | Create new event | `create_event` |
| `/api/event-admin/{event_id}` | PUT | Update event details | Owner/Staff |
| `/api/event-admin/{event_id}/actions/update-status/{status}` | POST | Change event status | Owner/Staff |
| `/api/event-admin/{event_id}/upload-logo` | POST | Upload event logo | Owner/Staff |
| `/api/event-admin/{event_id}/upload-cover-art` | POST | Upload cover art | Owner/Staff |
| `/api/event-admin/{event_id}/tags` | POST/DELETE | Manage event tags | Owner/Staff |

#### Ticket Tier Management

| Endpoint | Method | Purpose | Permission Required |
|----------|--------|---------|---------------------|
| `/api/event-admin/{event_id}/ticket-tier` | POST | Create ticket tier | Owner/Staff |
| `/api/event-admin/{event_id}/ticket-tier/{tier_id}` | PUT | Update ticket tier | Owner/Staff |
| `/api/event-admin/{event_id}/ticket-tier/{tier_id}` | DELETE | Delete ticket tier | Owner/Staff |
| `/api/event-admin/{event_id}/ticket-tiers` | GET | List ticket tiers | Owner/Staff |

#### Additional Event Admin

| Endpoint | Method | Purpose | Permission Required |
|----------|--------|---------|---------------------|
| `/api/event-admin/{event_id}/invitations` | GET/POST | Manage invitations | Owner/Staff |
| `/api/event-admin/{event_id}/token` | POST | Create event token | Owner/Staff |
| `/api/event-admin/{event_id}/tokens` | GET | List event tokens | Owner/Staff |

### Event Create Schema

**Required Fields:**
- `name` (string) - Event name
- `start` (string, date-time) - Start date/time

**Optional Fields:**
- `city_id` (unknown) - City reference
- `address` (string) - Venue address (single text field)
- `description` (string) - Event description (markdown)
- `event_type` (enum: Types) - Event type classification
- `status` (enum: Status) - Event status (draft, published, etc.)
- `visibility` (enum: Visibility) - Public, private, members-only, staff-only
- `invitation_message` (string) - Default message used when creating new invitations for this event
- `max_attendees` (integer) - Capacity limit
- `waitlist_open` (boolean) - Enable waitlist
- `end` (string, date-time) - End date/time
- `rsvp_before` (string, date-time) - RSVP deadline for non-ticketed events
- `check_in_starts_at` (string, date-time) - Check-in window start
- `check_in_ends_at` (string, date-time) - Check-in window end
- `event_series_id` (uuid) - Link to event series
- `free_for_members` (boolean) - Free admission for org members
- `free_for_staff` (boolean) - Free admission for org staff
- `requires_ticket` (boolean) - Toggle between RSVP and ticketing
- `potluck_open` (boolean) - Allow attendees to create potluck items (admins can always create items regardless of this setting)

### Event Update Schema

All fields optional (same as create schema).

### Ticket Tier Create Schema

**Required Fields:**
- `name` (string) - Tier name (e.g., "General Admission")

**Optional Fields:**
- `payment_method` (enum) - Online, At Door, Free
- `price` (decimal) - Fixed price
- `description` (string) - Tier description
- `visibility` (enum: Visibility) - Who can see this tier
- `purchasable_by` (enum) - Who can purchase (public, members, invitees)
- `price_type` (enum: PriceType) - Fixed or Pay-What-You-Can
- `pwyc_min` (decimal) - Minimum for PWYC
- `pwyc_max` (decimal) - Maximum for PWYC
- `currency` (string) - Currency code (default: USD)
- `sales_start_at` (date-time) - When sales begin
- `sales_end_at` (date-time) - When sales end
- `total_quantity` (integer) - Number of tickets available

### Enums

**Visibility (Who can VIEW the event):**
- `public` - Anyone can see the event listing
- `private` - Only invited users can see the event
- `members-only` - Only organization members can see
- `staff-only` - Only organization staff can see

**Types (Who can PARTICIPATE - RSVP/Buy Tickets):**
- `public` - Anyone can RSVP/purchase tickets
- `private` - Only invited users can RSVP/purchase tickets
- `members-only` - Only organization members can RSVP/purchase tickets

**Example:** An event with `visibility: public` and `type: members-only` means anyone can VIEW the event, but only members can RSVP or buy tickets. This gives organizers fine-grained control over discovery vs. participation.

**Status (Event Lifecycle):**
- `draft` - Being created, not visible to public
- `open` - Published and accepting RSVPs/ticket sales
- `closed` - Event ended or RSVP/sales closed
- `deleted` - Soft-deleted by organizers

**PriceType:**
- `fixed` - Fixed price
- `pwyc` - Pay What You Can

**Payment Methods:**
- Online (Stripe)
- At Door (cash/card on-site)
- Free

---

## User Journey Analysis

### Who Can Create Events?

According to `USER_JOURNEY.md`:

> **Creating Events:**
> - **Endpoint:** `POST /api/organization-admin/{slug}/create-event`
> - **Permissions:** `create_event`

**Access Control:**
- Organization owners (always have permission)
- Staff members with `create_event` permission

### Event Creation Flow (Revised for Speed)

**Philosophy:** Get events created FAST. Details can be added later.

1. **User navigates to organization admin panel**
   - Must be owner or staff with permissions
   - Click "Create Event" button

2. **Step 1: Essentials** (Required for 90% of events)
   - Event name (required)
   - Start date/time (required)
   - City (required) - Defaults: org city → user city → null
   - Visibility (required, defaults to "public") - Who can VIEW the event
   - Type (required, defaults to "public") - Who can PARTICIPATE (RSVP/buy tickets)
   - Requires ticket (toggle, defaults to false)

   **Actions:**
   - "Create Event" - Save as draft and move to Step 2

   **Note:** Publishing happens separately via status management actions, not from the wizard

3. **Step 2: Details** (Optional refinement)
   - **Basic Details:**
     - Description (markdown editor)
     - End date/time
     - Address (text field for venue)
   - **Ticketing Setup:**
     - RSVP deadline (if not ticketed)
     - Free for members/staff (if not ticketed)
     - Create ticket tiers (if ticketed)
   - **Capacity & Access:**
     - Max attendees
     - Waitlist toggle
     - Invitation message (default message for new invitations)
   - **Advanced:**
     - Check-in window
     - Potluck open (allow attendees to create potluck items; admins can always create items)
     - Tags (custom tags with autocomplete - backend does get_or_create)
     - Event series linkage (dropdown of organization's series)
     - Questionnaire (dropdown of organization's questionnaires, with "Create New" option → separate wizard)
   - **Media:**
     - Event logo
     - Cover art

   **Actions:**
   - "Back" - Return to Step 1
   - "Save Draft" - Save and exit (event remains in draft status)

   **Note:** To publish, user must use the status management actions after exiting the wizard

### Event Lifecycle

**States:**
- **Draft** - Being created, not visible to public
- **Open** - Published and accepting RSVPs/ticket sales (discoverable based on visibility)
- **Closed** - Event ended or RSVP/sales closed
- **Deleted** - Soft-deleted by organizers

**Transitions:**
- Draft → Open (via "Publish" action - `POST /api/event-admin/{event_id}/actions/update-status/open`)
- Open → Closed (via status update - `POST /api/event-admin/{event_id}/actions/update-status/closed`)
- Any → Deleted (via status update - `POST /api/event-admin/{event_id}/actions/update-status/deleted`)

---

## Existing Codebase Review

### Current Route Structure

```
src/routes/
├── (auth)/
│   ├── account/         ✅ User account management
│   └── dashboard/       ✅ Basic dashboard (needs enhancement)
└── (public)/
    ├── events/          ✅ Event discovery and details
    └── login/           ✅ Authentication
```

**Analysis:** No organization admin routes exist yet. We need to create the entire admin structure.

### Existing Form Components

```
src/lib/components/forms/
├── CityAutocomplete.svelte      ✅ Can reuse for location
├── PasswordStrengthIndicator.svelte
└── TwoFactorInput.svelte
```

**Analysis:** Limited form components. We need to create:
- Markdown editor component
- Date/time picker
- Image upload component
- Ticket tier editor

### Existing Event Components

```
src/lib/components/events/
├── EventCard.svelte             ✅ Display event cards
├── EventRSVPButton.svelte       ✅ RSVP functionality
├── PotluckItemCard.svelte       ✅ Potluck coordination
└── ... (many more)
```

**Analysis:** Strong component library for attendee-facing features. Need organizer-specific components.

### Form Handling Pattern

Based on existing authentication forms, the project uses:
- **Superforms** - Type-safe form handling
- **Zod** - Schema validation
- **Form actions** - Server-side processing via `+page.server.ts`

---

## Technical Design

### Routing Structure

Create new admin routes under organization context:

```
src/routes/(auth)/org/[slug]/admin/
├── +layout.svelte                   # Admin navigation and layout
├── +layout.server.ts                # Permission checks
├── +page.svelte                     # Admin dashboard (events list)
├── +page.server.ts                  # Load organization and events
├── events/
│   ├── +page.svelte                 # Event list (can redirect to parent)
│   ├── new/
│   │   ├── +page.svelte             # Event creation wizard
│   │   └── +page.server.ts          # Load org data, form actions
│   └── [event_id]/
│       ├── +page.svelte             # Event admin overview
│       ├── +page.server.ts          # Load event data
│       ├── edit/
│       │   ├── +page.svelte         # Edit wizard (reuse create wizard)
│       │   └── +page.server.ts      # Load event, form actions
│       └── settings/
│           ├── +page.svelte         # Advanced settings
│           └── +page.server.ts      # Settings form actions
```

**Key Design Decisions:**

1. **SSR for Initial Load** - Organization/event data loaded server-side
2. **Form Actions** - Server-side validation and API calls
3. **Client-Side Wizard Navigation** - Steps managed in browser
4. **Draft Auto-Save** - Client-side debounced saves via API

### Component Architecture

#### Core Wizard Components

```
src/lib/components/events/admin/
├── EventWizard.svelte               # Wizard shell (2-step flow)
├── wizard-steps/
│   ├── EssentialsStep.svelte        # Step 1: Name, date, city, visibility, type, ticketing
│   └── DetailsStep.svelte           # Step 2: Everything else (organized in sections)
├── TicketTierEditor.svelte          # Ticket tier CRUD
├── TicketTierCard.svelte            # Display tier
└── EventStatusBadge.svelte          # Draft/Open/Closed/Deleted badge
```

**Note:** The 2-step approach simplifies the wizard significantly. Step 1 is a single focused form. Step 2 groups related fields into collapsible sections.

#### Reusable Form Components

```
src/lib/components/forms/
├── MarkdownEditor.svelte            # Rich text editor for descriptions
├── DateTimePicker.svelte            # Date/time input
├── ImageUploader.svelte             # Drag-drop image upload
└── TagInput.svelte                  # Tag creation/selection
```

**Note:** AddressInput is not needed - the address field is a simple text input.

#### Component Hierarchy

```
EventWizard (2-Step Simplified)
├── StepIndicator ("Step 1 of 2" / "Step 2 of 2")
├── WizardStep (conditional render based on currentStep)
│   ├── EssentialsStep (Step 1 - Fast Creation)
│   │   ├── Input (name - required)
│   │   ├── DateTimePicker (start - required)
│   │   ├── CityAutocomplete (city - required, defaults: org city → user city → null)
│   │   ├── RadioGroup (visibility - required, defaults to "public")
│   │   ├── RadioGroup (type - required, defaults to "public")
│   │   └── Toggle (requires_ticket - defaults to false)
│   └── DetailsStep (Step 2 - Optional Refinement)
│       ├── Accordion (collapsible sections for organization)
│       │   ├── BasicDetailsSection
│       │   │   ├── MarkdownEditor (description)
│       │   │   ├── DateTimePicker (end)
│       │   │   └── Input (address - venue text field)
│       │   ├── TicketingSection (conditional on requires_ticket)
│       │   │   ├── IF ticketed: TicketTierEditor[]
│       │   │   ├── IF not ticketed: DateTimePicker (rsvp_before)
│       │   │   ├── IF not ticketed: Checkbox (free_for_members)
│       │   │   └── IF not ticketed: Checkbox (free_for_staff)
│       │   ├── CapacitySection
│       │   │   ├── NumberInput (max_attendees)
│       │   │   ├── Checkbox (waitlist_open)
│       │   │   └── Textarea (invitation_message - default for invites)
│       │   ├── AdvancedSection
│       │   │   ├── DateTimePicker (check_in_starts_at)
│       │   │   ├── DateTimePicker (check_in_ends_at)
│       │   │   ├── Checkbox (potluck_open - let attendees create items)
│       │   │   ├── TagInput (tags - custom with autocomplete)
│       │   │   ├── Select (event_series_id - dropdown of org's series)
│       │   │   └── Select (questionnaire_id - dropdown of org's questionnaires + "Create New")
│       │   └── MediaSection
│       │       ├── ImageUploader (logo)
│       │       └── ImageUploader (cover_art)
└── WizardNavigation
    ├── Step 1: "Cancel" | "Create Event" (→ Step 2, saves as draft)
    └── Step 2: "Back" (→ Step 1) | "Save & Exit" (→ done, stays draft)
```

**Key Improvements:**
- **Step 1:** Only 6 essential fields (name, start, city, visibility, type, ticketing)
- **Smart defaults:** City (org → user → null), Visibility (public), Type (public), Ticketing (false)
- **Step 2:** Organized in collapsible sections to reduce visual overwhelm
- **Draft-first:** All events saved as draft; publishing is a separate action
- **Flexibility:** User configures details in Step 2, then publishes when ready

### State Management Strategy

#### Wizard State (Revised for 2-Step Flow)

Use Svelte 5 Runes for local wizard state:

```svelte
<script lang="ts">
  // Wizard navigation
  let currentStep = $state(1);
  const totalSteps = 2;

  // Form data (matches EventCreateSchema)
  let eventData = $state<EventCreateSchema>({
    name: '',
    start: '',
    // ... all optional fields
  });

  // Ticket tiers (managed separately)
  let ticketTiers = $state<TicketTierCreateSchema[]>([]);

  // Validation state
  let errors = $state<Record<string, string>>({});

  // Draft saving
  let isDraftSaving = $state(false);
  let lastSaved = $state<Date | null>(null);

  // Derived state
  let canProceed = $derived(validateCurrentStep(currentStep));
  let isComplete = $derived(currentStep === totalSteps);
</script>
```

#### Server State (TanStack Query)

```typescript
// Query for organization data
const orgQuery = useQuery({
  queryKey: ['organization', slug],
  queryFn: () => api.organizations.getOrganization({ slug })
});

// Query for draft event (if resuming)
const draftQuery = useQuery({
  queryKey: ['event', 'draft', draftId],
  queryFn: () => api.eventAdmin.getEvent({ eventId: draftId }),
  enabled: !!draftId
});

// Mutation for creating event
const createEventMutation = useMutation({
  mutationFn: (data: EventCreateSchema) =>
    api.organizationAdmin.createEvent({ slug, data }),
  onSuccess: (event) => {
    // Navigate to event admin page
    goto(`/org/${slug}/admin/events/${event.id}`);
  }
});

// Mutation for auto-saving draft
const saveDraftMutation = useMutation({
  mutationFn: (data: EventUpdateSchema) =>
    api.eventAdmin.updateEvent({ eventId: draftId, data }),
  // Don't show error toasts for background saves
  onError: () => console.warn('Draft save failed')
});
```

#### Draft Auto-Save Pattern

```svelte
<script lang="ts">
  import { debounce } from '$lib/utils';

  // Auto-save debounced
  const autoSave = debounce(() => {
    if (draftId && eventData.name) {
      isDraftSaving = true;
      saveDraftMutation.mutate(eventData, {
        onSettled: () => {
          isDraftSaving = false;
          lastSaved = new Date();
        }
      });
    }
  }, 3000); // Save 3s after last change

  // Watch for changes
  $effect(() => {
    // Trigger on any eventData change
    const data = eventData;
    autoSave();
  });
</script>
```

### Data Flow

#### Event Creation Flow

```
1. User navigates to /org/{slug}/admin/events/new

2. +page.server.ts loads:
   - Organization data (verify permissions)
   - Existing draft (if resuming)

3. Client-side wizard:
   - User fills form fields
   - Auto-save to draft (debounced)
   - Validation on blur/change

4. On "Publish" or "Save Draft":
   - Validate all required fields
   - Call POST /api/organization-admin/{slug}/create-event
   - If published:
     - Upload images (if provided)
     - Create ticket tiers (if ticketed)
     - Add tags
   - Navigate to event admin page
```

#### Event Editing Flow

```
1. User navigates to /org/{slug}/admin/events/{id}/edit

2. +page.server.ts loads:
   - Event data (verify permissions)
   - Ticket tiers (if ticketed)
   - Tags

3. Populate wizard with existing data:
   - Pre-fill all form fields
   - Load existing images
   - Display current ticket tiers

4. On "Save Changes":
   - Validate changes
   - Call PUT /api/event-admin/{event_id}
   - Update ticket tiers (POST/PUT/DELETE)
   - Upload new images (if changed)
   - Update tags
   - Show success toast
```

### Permission Checks

#### Server-Side (Layout)

```typescript
// src/routes/(auth)/org/[slug]/admin/+layout.server.ts
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, params }) => {
  const user = locals.user;
  if (!user) {
    throw error(401, 'Unauthorized');
  }

  // Load organization
  const org = await api.organizations.getOrganization({
    slug: params.slug,
    headers: { Authorization: `Bearer ${user.accessToken}` }
  });

  // Check if user is owner or staff
  const isOwner = org.owner?.id === user.id;
  const isStaff = org.staff?.some(s => s.user.id === user.id);

  if (!isOwner && !isStaff) {
    throw error(403, 'You do not have permission to manage this organization');
  }

  // For event creation, check create_event permission
  const staffMember = org.staff?.find(s => s.user.id === user.id);
  const canCreateEvent = isOwner || staffMember?.permissions?.create_event;

  return {
    organization: org,
    isOwner,
    isStaff,
    canCreateEvent,
    permissions: staffMember?.permissions || {}
  };
};
```

#### Client-Side (Conditional Rendering)

```svelte
<script lang="ts">
  import { page } from '$app/stores';

  const { organization, canCreateEvent } = $page.data;
</script>

{#if canCreateEvent}
  <Button href="/org/{organization.slug}/admin/events/new">
    Create Event
  </Button>
{:else}
  <p>You do not have permission to create events.</p>
{/if}
```

---

## Accessibility Requirements

### WCAG 2.1 AA Compliance Checklist

#### Keyboard Navigation
- [ ] All form fields accessible via Tab/Shift+Tab
- [ ] Wizard steps navigable via keyboard
- [ ] Date picker keyboard accessible
- [ ] Image upload has keyboard trigger
- [ ] Modal dialogs trap focus
- [ ] Escape key closes modals

#### Screen Reader Support
- [ ] Wizard progress announced on step change
- [ ] Form errors announced via aria-live
- [ ] Required fields marked with aria-required
- [ ] Date picker has clear labels
- [ ] Image upload has descriptive instructions
- [ ] Success/error toasts announced

#### Visual Design
- [ ] Color contrast 4.5:1 for text
- [ ] Focus indicators on all interactive elements
- [ ] Error states clearly visible
- [ ] Loading states indicated
- [ ] Form labels associated with inputs

#### Semantic HTML
- [ ] Proper heading hierarchy (h1 → h2 → h3)
- [ ] Form elements use <label> tags
- [ ] Buttons use <button> (not div with onclick)
- [ ] Form uses <form> element
- [ ] Sections use <section> or <div role="region">

### Example: Accessible Wizard Step

```svelte
<div role="group" aria-labelledby="step-title">
  <h2 id="step-title">Step 1: Basic Information</h2>

  <label for="event-name">
    Event Name <span aria-label="required">*</span>
  </label>
  <input
    id="event-name"
    type="text"
    bind:value={eventData.name}
    aria-required="true"
    aria-invalid={!!errors.name}
    aria-describedby={errors.name ? 'name-error' : undefined}
  />
  {#if errors.name}
    <div id="name-error" role="alert" class="text-red-600">
      {errors.name}
    </div>
  {/if}
</div>

<!-- Progress announced on change -->
<div role="status" aria-live="polite" class="sr-only">
  Step {currentStep} of {totalSteps}: {stepTitles[currentStep - 1]}
</div>
```

---

## Mobile UX Requirements

### Mobile-First Design Principles

1. **Touch-Friendly Targets**
   - All buttons minimum 44x44px
   - Form inputs comfortable to tap
   - Sufficient spacing between elements

2. **Responsive Wizard Layout**
   - Single column on mobile
   - Progress bar adapts (dots vs. full labels)
   - Navigation buttons stack vertically if needed

3. **Optimized Inputs**
   - Mobile keyboard types (datetime-local, number, url)
   - Date/time pickers use native controls on mobile
   - Markdown editor has simplified toolbar

4. **Image Upload**
   - Camera access on mobile devices
   - Thumbnail preview after upload
   - Compress images client-side before upload

5. **Progressive Disclosure**
   - Collapse advanced options by default
   - Accordion for ticket tiers
   - Minimize scrolling within steps

### Example: Mobile-Responsive Wizard

```svelte
<div class="wizard-container">
  <!-- Mobile: Compact progress -->
  <div class="progress-bar md:hidden">
    <div class="flex justify-center gap-2">
      {#each Array(totalSteps) as _, i}
        <div
          class="w-2 h-2 rounded-full"
          class:bg-primary={i < currentStep}
          class:bg-gray-300={i >= currentStep}
        />
      {/each}
    </div>
    <p class="text-sm text-center mt-2">
      Step {currentStep} of {totalSteps}
    </p>
  </div>

  <!-- Desktop: Full progress bar -->
  <div class="progress-bar hidden md:block">
    <ol class="flex items-center justify-between">
      {#each stepTitles as title, i}
        <li class="flex flex-col items-center">
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center"
            class:bg-primary={i < currentStep}
            class:text-white={i < currentStep}
          >
            {i + 1}
          </div>
          <span class="text-xs mt-1">{title}</span>
        </li>
      {/each}
    </ol>
  </div>

  <!-- Step content -->
  <div class="step-content p-4 md:p-8">
    {#if currentStep === 1}
      <BasicInfoStep bind:data={eventData} bind:errors />
    {/if}
    <!-- ... -->
  </div>

  <!-- Navigation: Stack on mobile -->
  <div class="wizard-nav flex flex-col md:flex-row gap-2 md:gap-4 p-4">
    {#if currentStep > 1}
      <Button variant="outline" onclick={previousStep} class="w-full md:w-auto">
        Previous
      </Button>
    {/if}
    {#if currentStep < totalSteps}
      <Button onclick={nextStep} disabled={!canProceed} class="w-full md:w-auto">
        Next
      </Button>
    {:else}
      <Button onclick={publish} class="w-full md:w-auto">
        Publish Event
      </Button>
    {/if}
  </div>
</div>
```

---

## Implementation Plan

### Phase 1: Foundation (7-9 hours)

**Goal:** Set up routing, layouts, and permission system.

#### Tasks

1. **Create Admin Route Structure** (2h)
   - [ ] Create `/src/routes/(auth)/org/[slug]/admin/+layout.svelte`
   - [ ] Create `/src/routes/(auth)/org/[slug]/admin/+layout.server.ts`
   - [ ] Implement permission checks (owner/staff verification)
   - [ ] Create admin navigation component
   - [ ] Add breadcrumbs for navigation context

2. **Create Event Admin Routes** (2h)
   - [ ] Create `/src/routes/(auth)/org/[slug]/admin/events/+page.svelte` (event list)
   - [ ] Create `/src/routes/(auth)/org/[slug]/admin/events/new/+page.svelte`
   - [ ] Create `/src/routes/(auth)/org/[slug]/admin/events/new/+page.server.ts`
   - [ ] Create `/src/routes/(auth)/org/[slug]/admin/events/[event_id]/edit/+page.svelte`
   - [ ] Create `/src/routes/(auth)/org/[slug]/admin/events/[event_id]/edit/+page.server.ts`

3. **Create Reusable Form Components** (3-4h)
   - [ ] `MarkdownEditor.svelte` - Rich text editor (use a library like `svelte-markdown-editor` or build simple textarea with preview)
   - [ ] `DateTimePicker.svelte` - Accessible date/time input (use native `<input type="datetime-local">` with polyfill)
   - [ ] `ImageUploader.svelte` - Drag-drop file upload with preview
   - [ ] `TagInput.svelte` - Tag creation with autocomplete

   **Note:** AddressInput is not needed - address is a simple text field.

**Deliverables:**
- Admin routing structure
- Permission-protected layouts
- Reusable form components
- Basic event list page

**Testing:**
- Permission checks work (owner/staff only)
- Routes load correctly
- Form components render and accept input

---

### Phase 2: Event Creation Wizard (5-6 hours)

**Goal:** Build fast 2-step wizard for creating events.

#### Tasks

4. **Create Wizard Shell** (1h)
   - [ ] `EventWizard.svelte` - Wizard container (2-step flow)
   - [ ] Step indicator ("Step 1 of 2")
   - [ ] Step validation logic
   - [ ] Navigation buttons (context-aware)
   - [ ] Unsaved changes warning

5. **Step 1: Essentials** (2-3h)
   - [ ] `EssentialsStep.svelte` - Fast event creation
   - [ ] Event name (required, Input)
   - [ ] Start date/time (required, DateTimePicker)
   - [ ] City (required, CityAutocomplete) - **Defaults: org city → user city (`/api/preferences/general`) → null**
   - [ ] Visibility (required, RadioGroup, defaults to "public") - Who can VIEW the event
   - [ ] Type (required, RadioGroup, defaults to "public") - Who can PARTICIPATE (RSVP/buy tickets)
   - [ ] Requires ticket (Toggle, defaults to false)
   - [ ] Validation: name, start, city required
   - [ ] Action:
     - [ ] "Create Event" button → Save as draft, proceed to Step 2

6. **Step 2: Details** (2-3h)
   - [ ] `DetailsStep.svelte` - Optional refinement (organized in sections)
   - [ ] **Accordion/Collapsible Sections:**
     - [ ] **Basic Details Section:**
       - [ ] Description (MarkdownEditor, optional)
       - [ ] End date/time (DateTimePicker, optional)
       - [ ] Address (Input text field, optional)
     - [ ] **Ticketing Section:**
       - [ ] IF `requires_ticket === true`: Ticket tier editor
       - [ ] IF `requires_ticket === false`: RSVP settings
         - [ ] RSVP deadline (DateTimePicker)
         - [ ] Free for members (Checkbox)
         - [ ] Free for staff (Checkbox)
     - [ ] **Capacity Section:**
       - [ ] Max attendees (NumberInput)
       - [ ] Waitlist open (Checkbox)
       - [ ] Invitation message (Textarea - default message for invitations)
     - [ ] **Advanced Section:**
       - [ ] Check-in starts at (DateTimePicker)
       - [ ] Check-in ends at (DateTimePicker)
       - [ ] Potluck open (Checkbox - allow attendees to create potluck items; admins can always create)
       - [ ] Tags (TagInput with autocomplete - backend does get_or_create)
       - [ ] Event series (Select/Dropdown of organization's series)
       - [ ] Questionnaire (Select/Dropdown of organization's questionnaires + "Create New" option → triggers separate questionnaire wizard)
     - [ ] **Media Section:**
       - [ ] Logo upload (ImageUploader)
       - [ ] Cover art upload (ImageUploader)
   - [ ] Actions:
     - [ ] "Back" button → Return to Step 1
     - [ ] "Save & Exit" button → Save draft and exit wizard

**Deliverables:**
- 2-step event creation wizard
- Step 1: Fast creation with essentials only (6 fields)
- Step 2: Optional details in collapsible accordion sections
- Smart defaults (city, visibility, type, ticketing)
- Draft-first workflow (publishing is separate)
- Client-side validation
- Auto-save capability
- Tag autocomplete
- Event series dropdown
- Questionnaire linking with "Create New" option

**Testing:**
- Create event with Step 1 essentials only
- Create event with full Step 2 details
- Validation prevents proceeding without required fields (name, start, city)
- City defaults correctly: org city → user preference → null
- Visibility defaults to "public"
- Type defaults to "public"
- Requires ticket defaults to false
- Can navigate back from Step 2 to Step 1
- Tag autocomplete works
- Event series dropdown loads org's series
- Questionnaire dropdown loads org's questionnaires
- "Create New" questionnaire option triggers questionnaire wizard (deferred implementation)

---

### Phase 3: Ticket Tier Management (3-4 hours)

**Goal:** Create and manage ticket tiers for ticketed events.

#### Tasks

12. **Ticket Tier Editor Component** (2h)
    - [ ] `TicketTierEditor.svelte`
    - [ ] Tier name (required)
    - [ ] Description (textarea)
    - [ ] Price type (fixed vs. PWYC)
    - [ ] Price input (decimal)
    - [ ] PWYC min/max (if PWYC selected)
    - [ ] Quantity available (integer)
    - [ ] Sales window (start/end DateTimePickers)
    - [ ] Visibility (radio group)
    - [ ] Purchasable by (radio group)
    - [ ] Payment method (radio group)
    - [ ] Validation: all required fields

13. **Ticket Tier Display** (1h)
    - [ ] `TicketTierCard.svelte`
    - [ ] Display tier info in compact card
    - [ ] Edit button
    - [ ] Delete button (with confirmation)
    - [ ] Drag-to-reorder capability (nice-to-have)

14. **Tier CRUD Operations** (1-2h)
    - [ ] Add new tier
    - [ ] Edit existing tier
    - [ ] Delete tier (with confirmation dialog)
    - [ ] Server-side API integration (POST/PUT/DELETE)

**Deliverables:**
- Ticket tier creation/editing UI
- Full CRUD operations
- Validation for all tier fields

**Testing:**
- Create multiple tiers
- Edit tier details
- Delete tier with confirmation
- Validation prevents invalid tiers

---

### Phase 4: Event Editing & Management (4-5 hours)

**Goal:** Edit existing events and manage event status.

#### Tasks

15. **Event List Page** (1.5h)
    - [ ] Display organization's events
    - [ ] Filter: All / Draft / Published / Cancelled
    - [ ] Event cards with quick actions
    - [ ] Edit button → navigates to edit wizard
    - [ ] Status badge (draft/published/cancelled)
    - [ ] Loading states and skeletons

16. **Edit Event Wizard** (2h)
    - [ ] Reuse EventWizard component
    - [ ] Load existing event data into wizard
    - [ ] Pre-populate all fields
    - [ ] Load existing ticket tiers
    - [ ] Show current images
    - [ ] Update API call (PUT instead of POST)

17. **Event Status Management** (1h)
    - [ ] Publish event action (draft → open)
    - [ ] Close event action (open → closed)
    - [ ] Delete event action (any → deleted, with confirmation)
    - [ ] Status indicator on event page
    - [ ] API integration: `POST /api/event-admin/{event_id}/actions/update-status/{status}` where status is `open`, `closed`, or `deleted`

18. **Event Admin Dashboard** (0.5h)
    - [ ] `/org/{slug}/admin/events/{event_id}/+page.svelte`
    - [ ] Event overview (basic stats)
    - [ ] Quick actions (edit, cancel, view public page)
    - [ ] Tabs: Overview / Attendees / Settings

**Deliverables:**
- Event editing workflow
- Event status management (open, closed, deleted)
- Event admin dashboard

**Testing:**
- Edit event and save changes
- Publish draft event (draft → open)
- Close event (open → closed)
- Delete event (any → deleted)
- Status updates reflected immediately

---

### Phase 5: Draft Auto-Save & Resume (2-3 hours)

**Goal:** Auto-save drafts and resume creation.

#### Tasks

19. **Auto-Save Implementation** (1.5h)
    - [ ] Debounced save function (3s delay)
    - [ ] Save draft via PUT /api/event-admin/{event_id}
    - [ ] Save indicator ("Saving..." / "Saved at 3:45 PM")
    - [ ] Error handling (silent failure, log to console)
    - [ ] Only save if event has name

20. **Resume Draft Flow** (1h)
    - [ ] Detect if user has incomplete draft
    - [ ] Show "Resume draft" option on events list
    - [ ] Load draft data into wizard
    - [ ] Navigate to last completed step

21. **Unsaved Changes Warning** (0.5h)
    - [ ] Detect if form has unsaved changes
    - [ ] Show warning on navigate away
    - [ ] Use `beforeunload` event
    - [ ] Don't warn if auto-save just completed

**Deliverables:**
- Auto-save functionality
- Resume draft capability
- Unsaved changes protection

**Testing:**
- Start creating event, navigate away, resume draft
- Auto-save triggers after typing
- Changes saved correctly
- Warning shows on close tab

---

### Phase 6: Image Upload Integration (2-3 hours)

**Goal:** Upload and manage event images.

#### Tasks

22. **Image Upload API Integration** (1.5h)
    - [ ] Implement upload to `POST /api/event-admin/{event_id}/upload-logo`
    - [ ] Implement upload to `POST /api/event-admin/{event_id}/upload-cover-art`
    - [ ] Handle multipart/form-data
    - [ ] Progress indicator during upload
    - [ ] Error handling (file too large, wrong type)

23. **Image Preview & Management** (1h)
    - [ ] Show thumbnail after upload
    - [ ] Remove image button
    - [ ] Replace image functionality
    - [ ] Crop/resize UI (optional, nice-to-have)

24. **Client-Side Image Optimization** (0.5h)
    - [ ] Compress images before upload (use library like `browser-image-compression`)
    - [ ] Validate dimensions (recommend 16:9 aspect ratio)
    - [ ] Max file size check (5MB)

**Deliverables:**
- Image upload functionality
- Preview and management
- Client-side optimization

**Testing:**
- Upload logo and cover art
- Preview displays correctly
- Remove and replace images
- Large files rejected

---

### Phase 7: Polish & Optimization (3-4 hours)

**Goal:** Improve UX, accessibility, and performance.

#### Tasks

25. **Loading States & Skeletons** (1h)
    - [ ] Skeleton for event list
    - [ ] Loading spinner for wizard submit
    - [ ] Disabled state during API calls
    - [ ] Optimistic updates where possible

26. **Error Handling** (1h)
    - [ ] Display API errors in toasts
    - [ ] Form validation errors inline
    - [ ] Network error handling
    - [ ] Retry mechanism for failed requests

27. **Accessibility Audit** (1h)
    - [ ] Run axe DevTools on all pages
    - [ ] Fix keyboard navigation issues
    - [ ] Test with screen reader (VoiceOver/NVDA)
    - [ ] Verify ARIA labels
    - [ ] Color contrast check

28. **Mobile Testing & Fixes** (1h)
    - [ ] Test on mobile devices (iOS/Android)
    - [ ] Fix touch target sizes
    - [ ] Verify date pickers work on mobile
    - [ ] Test image upload from camera
    - [ ] Optimize layout for small screens

**Deliverables:**
- Polished user experience
- Comprehensive error handling
- Full accessibility compliance
- Mobile-optimized interface

**Testing:**
- Test on mobile devices
- Keyboard navigation works
- Screen reader announces correctly
- Error states display clearly

---

### Phase 8: Testing (2-3 hours)

**Goal:** Comprehensive test coverage.

#### Tasks

29. **Unit Tests** (1h)
    - [ ] Validation functions
    - [ ] Date/time utilities
    - [ ] Permission check logic
    - [ ] Form field parsing

30. **Component Tests** (1h)
    - [ ] EventWizard navigation
    - [ ] TicketTierEditor validation
    - [ ] ImageUploader file handling
    - [ ] Form submission

31. **E2E Tests** (1h)
    - [ ] Create event end-to-end
    - [ ] Edit event flow
    - [ ] Ticket tier creation
    - [ ] Draft save and resume
    - [ ] Permission enforcement

**Deliverables:**
- Test coverage >80%
- E2E tests for critical paths

**Testing:**
- All tests pass
- Coverage report generated

---

## Code Examples

### 1. Event Wizard Component

```svelte
<!-- src/lib/components/events/admin/EventWizard.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Button } from '$lib/components/ui/button';
  import type { EventCreateSchema, TicketTierCreateSchema } from '$lib/api';

  // Props
  interface Props {
    organizationSlug: string;
    existingEvent?: EventDetailSchema; // For editing
  }
  let { organizationSlug, existingEvent }: Props = $props();

  // Steps
  const steps = [
    'Basic Info',
    'Location',
    'Ticketing',
    'Access',
    'Advanced',
    'Media',
    'Review'
  ];

  let currentStep = $state(1);

  // Form data
  let eventData = $state<Partial<EventCreateSchema>>({
    name: existingEvent?.name || '',
    description: existingEvent?.description || '',
    start: existingEvent?.start || '',
    end: existingEvent?.end || '',
    visibility: existingEvent?.visibility || 'public',
    requires_ticket: existingEvent?.requires_ticket || false,
    potluck_open: existingEvent?.potluck_open || false,
    // ... all other fields
  });

  let ticketTiers = $state<TicketTierCreateSchema[]>([]);

  // Validation
  let errors = $state<Record<string, string>>({});

  function validateStep(step: number): boolean {
    errors = {};

    if (step === 1) {
      if (!eventData.name?.trim()) {
        errors.name = 'Event name is required';
      }
      if (!eventData.start) {
        errors.start = 'Start date/time is required';
      }
      if (eventData.end && eventData.start && new Date(eventData.end) < new Date(eventData.start)) {
        errors.end = 'End date must be after start date';
      }
    }

    if (step === 3 && eventData.requires_ticket) {
      if (ticketTiers.length === 0) {
        errors.ticket_tiers = 'At least one ticket tier is required for ticketed events';
      }
    }

    // ... more validation

    return Object.keys(errors).length === 0;
  }

  let canProceed = $derived(validateStep(currentStep));

  // Navigation
  function nextStep() {
    if (validateStep(currentStep)) {
      currentStep++;
    }
  }

  function previousStep() {
    currentStep--;
  }

  // Submit
  async function publishEvent() {
    if (!validateStep(currentStep)) return;

    try {
      // Create event
      const event = await api.organizationAdmin.createEvent({
        slug: organizationSlug,
        data: eventData as EventCreateSchema
      });

      // Upload images if provided
      // Create ticket tiers if provided
      // Add tags

      goto(`/org/${organizationSlug}/admin/events/${event.id}`);
    } catch (err) {
      console.error('Failed to create event:', err);
      // Show error toast
    }
  }
</script>

<div class="wizard-container max-w-4xl mx-auto p-4">
  <!-- Progress Bar -->
  <div class="progress-bar mb-8">
    <div class="hidden md:flex items-center justify-between">
      {#each steps as step, i}
        <div class="flex flex-col items-center">
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center font-semibold"
            class:bg-primary={i < currentStep}
            class:text-white={i < currentStep}
            class:bg-gray-200={i >= currentStep}
          >
            {i + 1}
          </div>
          <span class="text-xs mt-2 text-center">{step}</span>
        </div>
        {#if i < steps.length - 1}
          <div class="flex-1 h-0.5 mx-2" class:bg-primary={i < currentStep - 1} class:bg-gray-200={i >= currentStep - 1} />
        {/if}
      {/each}
    </div>

    <!-- Mobile: Simple step counter -->
    <div class="md:hidden text-center">
      <p class="text-sm text-muted-foreground">
        Step {currentStep} of {steps.length}: {steps[currentStep - 1]}
      </p>
    </div>
  </div>

  <!-- Step Content -->
  <div class="step-content bg-card p-6 rounded-lg shadow">
    {#if currentStep === 1}
      <BasicInfoStep bind:data={eventData} bind:errors />
    {:else if currentStep === 2}
      <LocationStep bind:data={eventData} bind:errors />
    {:else if currentStep === 3}
      <TicketingStep bind:data={eventData} bind:tiers={ticketTiers} bind:errors />
    {:else if currentStep === 4}
      <AccessStep bind:data={eventData} bind:errors />
    {:else if currentStep === 5}
      <AdvancedStep bind:data={eventData} bind:errors />
    {:else if currentStep === 6}
      <MediaStep bind:data={eventData} bind:errors />
    {:else if currentStep === 7}
      <ReviewStep {eventData} {ticketTiers} />
    {/if}
  </div>

  <!-- Navigation -->
  <div class="wizard-nav flex flex-col md:flex-row gap-3 mt-6">
    <Button
      variant="outline"
      onclick={previousStep}
      disabled={currentStep === 1}
      class="w-full md:w-auto"
    >
      Previous
    </Button>

    <div class="flex-1"></div>

    {#if currentStep < steps.length}
      <Button
        onclick={nextStep}
        disabled={!canProceed}
        class="w-full md:w-auto"
      >
        Next
      </Button>
    {:else}
      <Button
        onclick={publishEvent}
        class="w-full md:w-auto"
      >
        Publish Event
      </Button>
    {/if}
  </div>

  <!-- Unsaved changes warning -->
  <div role="status" aria-live="polite" class="sr-only">
    Step {currentStep} of {steps.length}: {steps[currentStep - 1]}
  </div>
</div>
```

### 2. Basic Info Step

```svelte
<!-- src/lib/components/events/admin/wizard-steps/BasicInfoStep.svelte -->
<script lang="ts">
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
  import DateTimePicker from '$lib/components/forms/DateTimePicker.svelte';
  import type { EventCreateSchema } from '$lib/api';

  interface Props {
    data: Partial<EventCreateSchema>;
    errors: Record<string, string>;
  }
  let { data, errors }: Props = $props();
</script>

<div class="space-y-6">
  <h2 class="text-2xl font-bold">Basic Information</h2>

  <!-- Event Name -->
  <div>
    <Label for="event-name">
      Event Name <span class="text-destructive">*</span>
    </Label>
    <Input
      id="event-name"
      type="text"
      bind:value={data.name}
      placeholder="e.g., Monthly Tech Meetup"
      aria-required="true"
      aria-invalid={!!errors.name}
      aria-describedby={errors.name ? 'name-error' : undefined}
      class:border-destructive={!!errors.name}
    />
    {#if errors.name}
      <p id="name-error" role="alert" class="text-sm text-destructive mt-1">
        {errors.name}
      </p>
    {/if}
  </div>

  <!-- Description -->
  <div>
    <Label for="event-description">Description</Label>
    <MarkdownEditor
      id="event-description"
      bind:value={data.description}
      placeholder="Describe your event..."
    />
    <p class="text-xs text-muted-foreground mt-1">
      Supports Markdown formatting
    </p>
  </div>

  <!-- Start Date/Time -->
  <div>
    <Label for="event-start">
      Start Date & Time <span class="text-destructive">*</span>
    </Label>
    <DateTimePicker
      id="event-start"
      bind:value={data.start}
      aria-required="true"
      aria-invalid={!!errors.start}
      aria-describedby={errors.start ? 'start-error' : undefined}
    />
    {#if errors.start}
      <p id="start-error" role="alert" class="text-sm text-destructive mt-1">
        {errors.start}
      </p>
    {/if}
  </div>

  <!-- End Date/Time -->
  <div>
    <Label for="event-end">End Date & Time</Label>
    <DateTimePicker
      id="event-end"
      bind:value={data.end}
      aria-invalid={!!errors.end}
      aria-describedby={errors.end ? 'end-error' : undefined}
    />
    {#if errors.end}
      <p id="end-error" role="alert" class="text-sm text-destructive mt-1">
        {errors.end}
      </p>
    {/if}
  </div>
</div>
```

### 3. Ticket Tier Editor

```svelte
<!-- src/lib/components/events/admin/TicketTierEditor.svelte -->
<script lang="ts">
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';
  import { RadioGroup, RadioGroupItem } from '$lib/components/ui/radio-group';
  import { Button } from '$lib/components/ui/button';
  import type { TicketTierCreateSchema } from '$lib/api';

  interface Props {
    tier: Partial<TicketTierCreateSchema>;
    onSave: (tier: TicketTierCreateSchema) => void;
    onCancel: () => void;
  }
  let { tier, onSave, onCancel }: Props = $props();

  let localTier = $state({ ...tier });
  let errors = $state<Record<string, string>>({});

  function validate(): boolean {
    errors = {};

    if (!localTier.name?.trim()) {
      errors.name = 'Tier name is required';
    }

    if (localTier.price_type === 'fixed' && !localTier.price) {
      errors.price = 'Price is required for fixed-price tiers';
    }

    if (localTier.price_type === 'pwyc') {
      if (!localTier.pwyc_min) {
        errors.pwyc_min = 'Minimum price is required for PWYC';
      }
    }

    // ... more validation

    return Object.keys(errors).length === 0;
  }

  function handleSave() {
    if (validate()) {
      onSave(localTier as TicketTierCreateSchema);
    }
  }
</script>

<div class="space-y-4 border rounded-lg p-4">
  <h3 class="font-semibold">Ticket Tier</h3>

  <!-- Tier Name -->
  <div>
    <Label for="tier-name">
      Tier Name <span class="text-destructive">*</span>
    </Label>
    <Input
      id="tier-name"
      type="text"
      bind:value={localTier.name}
      placeholder="e.g., General Admission"
      aria-required="true"
      aria-invalid={!!errors.name}
    />
    {#if errors.name}
      <p role="alert" class="text-sm text-destructive mt-1">{errors.name}</p>
    {/if}
  </div>

  <!-- Description -->
  <div>
    <Label for="tier-description">Description</Label>
    <Textarea
      id="tier-description"
      bind:value={localTier.description}
      placeholder="Optional description"
    />
  </div>

  <!-- Price Type -->
  <div>
    <Label>Price Type</Label>
    <RadioGroup bind:value={localTier.price_type}>
      <div class="flex items-center space-x-2">
        <RadioGroupItem value="fixed" id="price-fixed" />
        <Label for="price-fixed" class="font-normal">Fixed Price</Label>
      </div>
      <div class="flex items-center space-x-2">
        <RadioGroupItem value="pwyc" id="price-pwyc" />
        <Label for="price-pwyc" class="font-normal">Pay What You Can</Label>
      </div>
    </RadioGroup>
  </div>

  <!-- Price -->
  {#if localTier.price_type === 'fixed'}
    <div>
      <Label for="tier-price">
        Price <span class="text-destructive">*</span>
      </Label>
      <Input
        id="tier-price"
        type="number"
        step="0.01"
        bind:value={localTier.price}
        placeholder="0.00"
        aria-required="true"
      />
      {#if errors.price}
        <p role="alert" class="text-sm text-destructive mt-1">{errors.price}</p>
      {/if}
    </div>
  {:else if localTier.price_type === 'pwyc'}
    <div class="grid grid-cols-2 gap-4">
      <div>
        <Label for="tier-pwyc-min">Min Price</Label>
        <Input
          id="tier-pwyc-min"
          type="number"
          step="0.01"
          bind:value={localTier.pwyc_min}
          placeholder="0.00"
        />
      </div>
      <div>
        <Label for="tier-pwyc-max">Max Price</Label>
        <Input
          id="tier-pwyc-max"
          type="number"
          step="0.01"
          bind:value={localTier.pwyc_max}
          placeholder="100.00"
        />
      </div>
    </div>
  {/if}

  <!-- Quantity -->
  <div>
    <Label for="tier-quantity">Total Quantity</Label>
    <Input
      id="tier-quantity"
      type="number"
      bind:value={localTier.total_quantity}
      placeholder="Unlimited"
    />
  </div>

  <!-- Actions -->
  <div class="flex gap-2">
    <Button onclick={handleSave}>Save Tier</Button>
    <Button variant="outline" onclick={onCancel}>Cancel</Button>
  </div>
</div>
```

### 4. Auto-Save Implementation

```svelte
<!-- In EventWizard.svelte -->
<script lang="ts">
  import { debounce } from '$lib/utils';
  import { useMutation } from '@tanstack/svelte-query';
  import { api } from '$lib/api';

  let draftId = $state<string | null>(null);
  let isDraftSaving = $state(false);
  let lastSaved = $state<Date | null>(null);

  // Mutation for auto-saving
  const saveDraftMutation = useMutation({
    mutationFn: (data: Partial<EventUpdateSchema>) => {
      if (!draftId) {
        // Create draft first
        return api.organizationAdmin.createEvent({
          slug: organizationSlug,
          data: { ...data, status: 'draft' } as EventCreateSchema
        }).then(event => {
          draftId = event.id;
          return event;
        });
      } else {
        // Update existing draft
        return api.eventAdmin.updateEvent({
          eventId: draftId,
          data
        });
      }
    },
    onMutate: () => {
      isDraftSaving = true;
    },
    onSuccess: () => {
      lastSaved = new Date();
    },
    onError: (err) => {
      console.warn('Auto-save failed:', err);
    },
    onSettled: () => {
      isDraftSaving = false;
    }
  });

  // Debounced auto-save
  const autoSave = debounce(() => {
    if (eventData.name && eventData.start) {
      saveDraftMutation.mutate(eventData);
    }
  }, 3000);

  // Watch for changes to eventData
  $effect(() => {
    // Trigger auto-save whenever eventData changes
    const data = eventData;
    autoSave();
  });
</script>

<!-- Draft save indicator -->
<div class="text-sm text-muted-foreground mt-2">
  {#if isDraftSaving}
    <span>Saving draft...</span>
  {:else if lastSaved}
    <span>Last saved at {lastSaved.toLocaleTimeString()}</span>
  {:else}
    <span>Unsaved changes</span>
  {/if}
</div>
```

---

## Testing Strategy

### Unit Tests

**Test Files:**
- `src/lib/utils/eventValidation.test.ts`
- `src/lib/utils/ticketTierValidation.test.ts`
- `src/lib/utils/dateUtils.test.ts`

**What to Test:**
- Validation functions (event name, dates, tiers)
- Date comparison logic (start before end)
- Permission checks
- Price calculations

**Example:**

```typescript
// src/lib/utils/eventValidation.test.ts
import { describe, it, expect } from 'vitest';
import { validateEventDates, validateTicketTier } from './eventValidation';

describe('validateEventDates', () => {
  it('should return error if start is after end', () => {
    const result = validateEventDates({
      start: '2025-12-01T10:00:00Z',
      end: '2025-11-30T10:00:00Z'
    });
    expect(result.errors.end).toBe('End date must be after start date');
  });

  it('should pass if dates are valid', () => {
    const result = validateEventDates({
      start: '2025-11-30T10:00:00Z',
      end: '2025-12-01T10:00:00Z'
    });
    expect(result.isValid).toBe(true);
  });
});
```

### Component Tests

**Test Files:**
- `src/lib/components/events/admin/EventWizard.test.ts`
- `src/lib/components/events/admin/TicketTierEditor.test.ts`
- `src/lib/components/forms/ImageUploader.test.ts`

**What to Test:**
- Wizard step navigation
- Form field binding
- Validation error display
- Button states (disabled/enabled)
- Image upload handling

**Example:**

```typescript
// src/lib/components/events/admin/EventWizard.test.ts
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import EventWizard from './EventWizard.svelte';

describe('EventWizard', () => {
  it('should not allow proceeding without required fields', async () => {
    const user = userEvent.setup();
    render(EventWizard, { props: { organizationSlug: 'test-org' } });

    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toBeDisabled();

    // Fill in event name
    const nameInput = screen.getByLabelText(/event name/i);
    await user.type(nameInput, 'Test Event');

    // Still disabled (missing start date)
    expect(nextButton).toBeDisabled();
  });

  it('should navigate to next step when valid', async () => {
    const user = userEvent.setup();
    render(EventWizard, { props: { organizationSlug: 'test-org' } });

    // Fill required fields
    await user.type(screen.getByLabelText(/event name/i), 'Test Event');
    // ... set start date

    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    // Should show step 2
    expect(screen.getByText(/location/i)).toBeInTheDocument();
  });
});
```

### E2E Tests (Playwright)

**Test Files:**
- `tests/e2e/event-creation.spec.ts`
- `tests/e2e/event-editing.spec.ts`
- `tests/e2e/permissions.spec.ts`

**What to Test:**
- Complete event creation flow
- Draft saving and resuming
- Event editing
- Ticket tier creation
- Permission enforcement (non-staff blocked)
- Image upload

**Example:**

```typescript
// tests/e2e/event-creation.spec.ts
import { test, expect } from '@playwright/test';

test('should create a ticketed event', async ({ page }) => {
  // Login as organization owner
  await page.goto('/login');
  await page.fill('[name="email"]', 'owner@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // Navigate to event creation
  await page.goto('/org/test-org/admin/events/new');

  // Step 1: Basic Info
  await page.fill('[name="name"]', 'Test Event');
  await page.fill('[name="description"]', 'This is a test event');
  await page.fill('[name="start"]', '2025-12-01T10:00');
  await page.fill('[name="end"]', '2025-12-01T18:00');
  await page.click('button:has-text("Next")');

  // Step 2: Location
  await page.fill('[name="city"]', 'San Francisco');
  await page.fill('[name="address"]', '123 Main St');
  await page.click('button:has-text("Next")');

  // Step 3: Ticketing
  await page.click('[value="true"]'); // Ticketed event
  await page.click('button:has-text("Add Tier")');
  await page.fill('[name="tier_name"]', 'General Admission');
  await page.fill('[name="tier_price"]', '25.00');
  await page.fill('[name="tier_quantity"]', '100');
  await page.click('button:has-text("Save Tier")');
  await page.click('button:has-text("Next")');

  // ... continue through steps

  // Step 7: Review & Publish
  await expect(page.locator('text=Test Event')).toBeVisible();
  await page.click('button:has-text("Publish Event")');

  // Should redirect to event admin page
  await expect(page).toHaveURL(/\/org\/test-org\/admin\/events\/[a-f0-9-]+/);
  await expect(page.locator('text=Event published successfully')).toBeVisible();
});

test('should enforce permissions', async ({ page }) => {
  // Login as regular user (not staff)
  await page.goto('/login');
  await page.fill('[name="email"]', 'user@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // Try to access event creation
  await page.goto('/org/test-org/admin/events/new');

  // Should be blocked
  await expect(page.locator('text=You do not have permission')).toBeVisible();
});
```

---

## Dependencies

### Required Before Starting

1. **Issue #1: API Client** ✅ COMPLETE
   - Auto-generated TypeScript API client exists

2. **Issue #19: Organization Management** ❌ NOT STARTED
   - Needed for organization admin routes
   - Organization data loading
   - Staff/owner verification

   **RESOLUTION:** Based on user clarification, we will implement a **minimal admin infrastructure** as part of this issue. This includes:
   - Basic `/org/[slug]/admin/` route structure
   - Permission verification in `+layout.server.ts`
   - Simple admin navigation (just Events for now)
   - Organization data loading

   This approach allows event creation to proceed without blocking on full organization management (#19). The admin infrastructure will be enhanced later when implementing:
   - Member management (#63)
   - Staff management (#65)
   - Organization settings
   - Organization resources (#66)

### Optional (Can Work Around)

1. **Issue #66: Organization Resources** - Not required for MVP
2. **Issue #67: Tags System** - Can use simple text input initially
3. **Issue #23: Questionnaire Builder** - Questionnaires can be linked but not created in wizard

---

## Risks & Considerations

### Technical Risks

1. **Complex Form State**
   - **Risk:** Managing wizard state across 7 steps can be error-prone
   - **Mitigation:** Use Svelte 5 runes for reactive state, comprehensive validation

2. **Image Upload Performance**
   - **Risk:** Large images slow down upload and consume bandwidth
   - **Mitigation:** Client-side compression, progress indicators, async upload

3. **Draft Auto-Save Conflicts**
   - **Risk:** Multiple tabs editing same draft could conflict
   - **Mitigation:** Warn on multiple tabs, lock draft to session

4. **Mobile Date Pickers**
   - **Risk:** Native date inputs vary by browser/OS
   - **Mitigation:** Use progressive enhancement, test on multiple devices

### UX Risks

1. **Wizard Abandonment**
   - **Risk:** Users quit mid-creation due to complexity
   - **Mitigation:** Auto-save drafts, clear progress indicator, allow skipping optional steps

2. **Ticket Tier Confusion**
   - **Risk:** Organizers confused by pricing options (fixed vs. PWYC)
   - **Mitigation:** Clear labels, help text, examples

3. **Permission Confusion**
   - **Risk:** Staff don't understand why they can't create events
   - **Mitigation:** Clear permission messages, link to owner for access request

### Business Risks

1. **Feature Creep**
   - **Risk:** Adding too many options makes wizard overwhelming
   - **Mitigation:** Focus on MVP, move advanced features to settings page

2. **Incomplete Events**
   - **Risk:** Draft events never published, clutter organization
   - **Mitigation:** Show draft count, prompt to finish or delete

---

## Success Metrics

### Functionality Checklist

- [ ] Organization owners can create events
- [ ] Staff with `create_event` permission can create events
- [ ] All required fields validated
- [ ] Ticketed events require at least one tier
- [ ] Drafts auto-save every 3 seconds
- [ ] Users can resume incomplete drafts
- [ ] Images upload successfully
- [ ] Events can be edited after creation
- [ ] Event status can be updated (draft → published, published → cancelled)

### Accessibility Checklist

- [ ] Passes axe DevTools audit (0 violations)
- [ ] Keyboard navigation works for all form fields
- [ ] Screen reader announces wizard progress
- [ ] Focus management between steps
- [ ] Form errors announced via aria-live
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] All images have alt text

### Performance Checklist

- [ ] Wizard loads in < 2 seconds
- [ ] Auto-save doesn't block UI
- [ ] Image uploads show progress
- [ ] No layout shift during load
- [ ] Bundle size increase < 50KB

### Mobile Checklist

- [ ] Wizard usable on 375px width
- [ ] Touch targets minimum 44x44px
- [ ] Date pickers work on iOS/Android
- [ ] Image upload from camera works
- [ ] Navigation buttons accessible

---

## Future Enhancements (Out of Scope for MVP)

These features can be added later:

1. **Recurring Events** - Link to event series (#26)
2. **Event Templates** - Save/reuse event configurations
3. **Bulk Event Creation** - Create multiple events at once
4. **Advanced Scheduling** - Multi-day events, sessions, tracks
5. **Collaborative Editing** - Multiple staff editing same event
6. **Event Duplication** - Clone existing event
7. **Advanced Analytics** - Ticket sales, RSVP trends
8. **Event Archiving** - Soft delete old events

---

## Implementation Timeline

**Total Estimated Effort:** 18-22 hours (reduced from 22-26 due to simplified 2-step wizard)

### Week 1 (7-9 hours)
- Phase 1: Foundation (7-9h)

### Week 2 (6-8 hours)
- Phase 2: Event Creation Wizard (5-6h) - **Significantly simplified**
- Phase 3: Ticket Tier Management (3-4h) - Start

### Week 3 (5-7 hours)
- Phase 3: Ticket Tier Management (complete if needed)
- Phase 4: Event Editing & Management (4-5h)
- Phase 5: Draft Auto-Save (2-3h)

### Week 4 (If needed, 2-4 hours)
- Phase 6: Image Upload Integration (2-3h)
- Phase 7: Polish & Optimization (3-4h)
- Phase 8: Testing (2-3h)

**Target Completion:** 2-3 weeks from start date (reduced from 3 weeks)

**Key Efficiency Gains:**
- 2-step wizard instead of 7 steps saves ~4-5 hours
- Simpler UI/UX requires less polish time
- Reduced testing surface area

---

## Clarifications Resolved

**All questions answered! Ready for implementation.**

1. **✅ Organization Management Dependency**
   - RESOLVED: Implement minimal admin infrastructure as part of this issue
   - Create basic `/org/[slug]/admin/` structure
   - Full organization management features deferred to #19

2. **✅ Visibility vs. Event Type**
   - RESOLVED: Two separate fields with distinct purposes
   - **Visibility:** Who can VIEW the event (public, private, members-only, staff-only)
   - **Type:** Who can PARTICIPATE/RSVP (public, private, members-only)
   - Example: `visibility: public, type: members-only` = Anyone can see it, only members can RSVP

3. **✅ Event Status**
   - RESOLVED: Four lifecycle states
   - `draft` - Being created, not visible
   - `open` - Published, accepting RSVPs/tickets
   - `closed` - Event ended or sales closed
   - `deleted` - Soft-deleted by organizers

4. **✅ Address Schema**
   - RESOLVED: Single text field (not structured)
   - Simple string for venue address

5. **✅ Tags**
   - RESOLVED: Custom tags with autocomplete
   - Backend does `get_or_create` when receiving tags
   - TagInput component with autocomplete of existing tags

6. **✅ Event Series**
   - RESOLVED: Include series linkage in wizard
   - Dropdown of organization's existing series
   - Optional field in Step 2 Advanced Section

7. **✅ Questionnaires**
   - RESOLVED: Include questionnaire linking in wizard
   - Dropdown of organization's existing questionnaires
   - "Create New" option triggers separate questionnaire wizard (separate issue)
   - Optional field in Step 2 Advanced Section

8. **✅ City Default Hierarchy**
   - RESOLVED: org.city → user preferences (`/api/preferences/general`) → null
   - Fallback to null if neither exists

9. **✅ Publishing Workflow**
   - RESOLVED: No "Create & Publish" button
   - All events created as draft
   - Publishing happens separately via status management actions (not in wizard)

10. **✅ Default Values**
   - Visibility: `"public"`
   - Type: `"public"`
   - Requires ticket: `false`

---

## Conclusion

This implementation plan provides a comprehensive roadmap for building the Event Creation & Management feature. The plan is structured to deliver an accessible, mobile-first, permission-controlled event creation wizard that integrates seamlessly with the Revel backend.

**Key Takeaways:**

- **Phased approach** - Foundation → Wizard → Tiers → Editing → Polish
- **Accessibility-first** - WCAG 2.1 AA compliance throughout
- **Mobile-optimized** - Responsive design, touch-friendly, native inputs
- **Permission-controlled** - Only owners and authorized staff can create events
- **Draft auto-save** - Never lose work, resume anytime
- **Comprehensive testing** - Unit, component, and E2E tests

**Next Steps:**

1. Review and approve this plan
2. Answer clarification questions
3. Create GitHub issues for each phase (if desired)
4. Begin Phase 1 implementation

**Document Version:** 1.0
**Author:** Project Manager Subagent
**Date:** 2025-10-20
