# Event Admin Components

This directory contains components for event administration, specifically the 2-step event creation wizard.

## Components

### EventWizard.svelte

Main wizard component that orchestrates the 2-step event creation flow.

**Props:**
- `organization: OrganizationRetrieveSchema` - The organization creating the event (required)
- `existingEvent?: EventDetailSchema` - Existing event data for edit mode (optional)
- `userCity?: CitySchema | null` - User's preferred city (optional)
- `orgCity?: CitySchema | null` - Organization's city (optional)
- `eventSeries?: EventSeriesRetrieveSchema[]` - Available event series (optional)
- `questionnaires?: QuestionnaireSchema[]` - Available questionnaires (optional)

**Usage:**
```svelte
<script lang="ts">
  import EventWizard from '$lib/components/events/admin/EventWizard.svelte';

  let { organization, userCity } = $props();
</script>

<EventWizard
  {organization}
  {userCity}
/>
```

**Features:**
- Step 1: Essentials (name, date, city, visibility, type, ticketing)
- Step 2: Details (description, capacity, advanced options, media)
- Auto-save to draft on Step 1 completion
- Full validation with inline error messages
- Image uploads (logo and cover art)
- Mobile-responsive design
- Full keyboard navigation support

### EssentialsStep.svelte

Step 1 of the wizard - captures essential event information.

**Props:**
- `formData: Partial<EventCreateSchema>` - Current form data
- `validationErrors: Record<string, string>` - Validation errors
- `orgCity?: CitySchema | null` - Organization's city for defaults
- `userCity?: CitySchema | null` - User's city for defaults
- `isEditMode: boolean` - Whether editing existing event
- `onUpdate: (data: Partial<EventCreateSchema>) => void` - Update callback
- `onSubmit: () => void` - Submit callback
- `isSaving: boolean` - Loading state

**Required Fields:**
- Event Name (min 3 characters)
- Start Date/Time (must be future date)
- City (from city autocomplete)

**Optional Fields:**
- Visibility (public/private/members-only/staff-only)
- Event Type (public/private/members-only)
- Requires Ticket (checkbox)

### DetailsStep.svelte

Step 2 of the wizard - captures additional event details.

**Props:**
- `formData: Partial<EventCreateSchema> & { tags?: string[] }` - Current form data
- `eventSeries?: EventSeriesRetrieveSchema[]` - Available event series
- `questionnaires?: QuestionnaireSchema[]` - Available questionnaires
- `onUpdate: (data: Partial<EventCreateSchema>) => void` - Update callback
- `onUpdateImages: (data: { logo?: File | null; coverArt?: File | null }) => void` - Image update callback

**Sections (Accordion):**

1. **Basic Details** (open by default)
   - Description (textarea with Markdown support)
   - End Date/Time
   - Address

2. **Ticketing** (shown when requires_ticket = true)
   - Placeholder for ticket tier management (Phase 3)

3. **RSVP Options** (shown when requires_ticket = false)
   - RSVP Deadline
   - Free for Members (checkbox)
   - Free for Staff (checkbox)

4. **Capacity**
   - Max Attendees (number input)
   - Waitlist Open (checkbox)
   - Invitation Message (textarea)

5. **Advanced**
   - Check-in Opens At
   - Check-in Closes At
   - Enable Potluck (checkbox)
   - Tags (tag input with add/remove)
   - Event Series (dropdown)
   - Questionnaire (dropdown - disabled for now)

6. **Media**
   - Logo Upload (file input)
   - Cover Art Upload (file input)

## API Integration

The EventWizard component handles all API calls:

### Create Event (Step 1)
```typescript
POST /api/organization-admin/{slug}/create-event
Body: EventCreateSchema
Response: EventDetailSchema
```

### Update Event (Step 2)
```typescript
PUT /api/event-admin/{event_id}
Body: Partial<EventCreateSchema>
Response: EventDetailSchema
```

### Upload Logo
```typescript
POST /api/event-admin/{event_id}/upload-logo
Body: { logo: File }
Response: EventDetailSchema
```

### Upload Cover Art
```typescript
POST /api/event-admin/{event_id}/upload-cover-art
Body: { cover_art: File }
Response: EventDetailSchema
```

## Validation

### Step 1 Validation
- **Event Name**: Required, min 3 characters
- **Start Date/Time**: Required, must be in the future
- **City**: Required

### Step 2 Validation
- No required fields (all optional enhancements)
- Validation happens on individual fields as needed

## Navigation Flow

```
User visits /org/{slug}/admin/events/new
  ↓
EventWizard renders (Step 1)
  ↓
User fills essentials → Clicks "Create Event"
  ↓
Validation passes
  ↓
POST /api/organization-admin/{slug}/create-event (status: "pending review")
  ↓
Store event ID in state
  ↓
Navigate to Step 2
  ↓
User fills details → Clicks "Save & Exit"
  ↓
PUT /api/event-admin/{event_id} (update with all details)
  ↓
Upload logo (if provided)
  ↓
Upload cover art (if provided)
  ↓
Invalidate queries
  ↓
Redirect to /org/{slug}/admin/events
```

## Accessibility Features

- **Semantic HTML**: Proper form elements, labels, and ARIA attributes
- **Keyboard Navigation**: All controls accessible via keyboard
- **Focus Management**: Logical tab order throughout wizard
- **Screen Reader Support**:
  - ARIA labels on all inputs
  - Error messages announced via `role="alert"`
  - Success messages announced via `role="status"`
  - Step indicator with `aria-current`
- **Color Contrast**: WCAG AA compliant
- **Visible Focus States**: All interactive elements have focus rings

## Mobile Responsiveness

- Mobile-first design approach
- Stack fields vertically on mobile
- Touch-friendly controls (44x44px minimum)
- Responsive accordion sections
- Optimized file inputs for mobile

## Testing

Run tests with:
```bash
pnpm test src/lib/components/events/admin
```

Test coverage includes:
- Component rendering
- Form input changes
- Validation error display
- Accordion toggling
- Tag management
- Keyboard accessibility
- Mobile responsiveness

## Future Enhancements (Not in Phase 1)

- Auto-save functionality (save draft periodically)
- Ticket tier management (Phase 3)
- Questionnaire integration (when available)
- Rich text editor for description (Markdown for now)
- Image preview before upload
- Drag-and-drop image upload
- Multi-step progress persistence (if user leaves and returns)

## Notes

- All form data matches `EventCreateSchema` from the API
- Images are uploaded separately after event creation
- Tags are stored as a simple string array
- Event is created with `status: "pending review"` initially
- City defaults to: orgCity → userCity → null (in that order)
- Visibility defaults to "public"
- Event type defaults to "public"
- Requires ticket defaults to false
