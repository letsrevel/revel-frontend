# requires_ticket Field Not Being Sent to Backend

## Issue

When creating or editing an event, the "Requires Ticket" checkbox value is never sent to the backend, regardless of whether it's checked or unchecked.

## Root Cause

### Backend Schema (revel-backend/src/events/schema.py)

The `requires_ticket` field is **commented out** in `EventEditSchema`:

```python
class EventEditSchema(CityEditMixin):
    name: OneToOneFiftyString | None = None
    # ... other fields ...
    # requires_ticket: bool = False  # <-- COMMENTED OUT
    potluck_open: bool = False
    # ... more fields ...
```

### Backend Model (revel-backend/src/events/models/event.py)

The model has the field with **default=True**:

```python
requires_ticket = models.BooleanField(default=True)  # If False, managed via RSVPs
```

### Frontend Code

The EventWizard component (src/lib/components/events/admin/EventWizard.svelte):

1. **Tracks the field in state** (line 133):
   ```typescript
   requires_ticket: (existingEvent as any)?.requires_ticket || false,
   ```

2. **Uses it for UI logic** (lines 584, 672, 693) to show/hide Step 3 (ticketing)

3. **But doesn't send it to the API** in either `handleStep1Submit` or `handleStep2Submit`

## Current Behavior

1. User checks/unchecks "Requires Ticket" checkbox ✅
2. UI updates to show/hide ticketing step ✅
3. Event is created with `requires_ticket=True` (backend default) ❌
4. Even if user unchecks the box, backend still gets `requires_ticket=True` ❌

## Required Changes

### Step 1: Backend Changes (MUST BE DONE FIRST)

**File**: `revel-backend/src/events/schema.py`

Uncomment and enable the `requires_ticket` field in EventEditSchema:

```python
class EventEditSchema(CityEditMixin):
    name: OneToOneFiftyString | None = None
    description: StrippedString | None = None
    event_type: Event.EventType | None = None
    status: Event.EventStatus = Event.EventStatus.DRAFT
    visibility: Event.Visibility | None = None
    invitation_message: StrippedString | None = Field(None, description="Invitation message")
    max_attendees: int = 0
    waitlist_open: bool = False
    start: AwareDatetime | None = None
    end: AwareDatetime | None = None
    rsvp_before: AwareDatetime | None = Field(None, description="RSVP deadline for events that do not require tickets")
    check_in_starts_at: AwareDatetime | None = Field(None, description="When check-in opens for this event")
    check_in_ends_at: AwareDatetime | None = Field(None, description="When check-in closes for this event")
    event_series_id: UUID | None = None
    free_for_members: bool = False
    free_for_staff: bool = True
    requires_ticket: bool = False  # <-- UNCOMMENT THIS LINE
    potluck_open: bool = False
    accept_invitation_requests: bool = False
    can_attend_without_login: bool = False
```

**Important Notes**:
- The field should default to `False` in the schema (simpler RSVP events are more common)
- The backend model defaults to `True` for backwards compatibility
- When the field is provided explicitly in the request, it overrides the model default

**Why this was commented out**: Likely because `requires_ticket` was intended to be immutable after event creation (see the UI warning in EssentialsStep.svelte lines 435-450). However, the field still needs to be settable **during creation**.

**Recommended approach**:
1. Allow setting `requires_ticket` in `EventCreateSchema`
2. Make it read-only in `EventEditSchema` (or remove from edit schema)
3. Add validation in the backend to prevent changing `requires_ticket` after event creation

### Step 2: Frontend Changes (AFTER Backend)

**File**: `src/lib/components/events/admin/EventWizard.svelte`

#### 2.1 Update `handleStep1Submit` (line 381)

```typescript
async function handleStep1Submit(): Promise<void> {
	if (!validateStep1()) {
		errorMessage = m['eventWizard.error_fixValidation']();
		return;
	}

	errorMessage = null;
	isSaving = true;

	try {
		// Prepare data for API - convert datetime-local to ISO with timezone
		const createData: EventCreateSchema = {
			name: formData.name!,
			start: toISOString(formData.start)!,
			city_id: formData.city_id!,
			visibility: formData.visibility || 'public',
			event_type: (formData.event_type || 'public') as any, // Backend has wrong enum
			status: 'draft' as any, // Create as draft by default
			requires_ticket: formData.requires_ticket || false  // ADD THIS LINE
		};

		if (eventId) {
			// Update existing event
			await updateEventMutation.mutateAsync({ id: eventId, data: createData });
		} else {
			// Create new event
			const result = await createEventMutation.mutateAsync(createData);
			eventId = result.id;
		}

		// Move to Step 2
		currentStep = 2;

		// Scroll to top for better UX
		window.scrollTo({ top: 0, behavior: 0.0, behavior: 'smooth' });
	} catch (error) {
		console.error('Step 1 submission error:', error);
	} finally {
		isSaving = false;
	}
}
```

#### 2.2 Update TypeScript Types

The EventCreateSchema type from the auto-generated API client will need to be regenerated after the backend change:

```bash
pnpm generate:api
```

### Step 3: Testing

After both backend and frontend changes:

1. **Test create event with requires_ticket=true**:
   - Check the box
   - Create event
   - Verify Step 3 (ticketing) appears
   - Save and verify event has `requires_ticket: true` in database

2. **Test create event with requires_ticket=false**:
   - Leave box unchecked (or uncheck it)
   - Create event
   - Verify Step 3 (ticketing) does NOT appear
   - Save and verify event has `requires_ticket: false` in database

3. **Test that requires_ticket is immutable**:
   - Create event with `requires_ticket: false`
   - Edit event
   - Verify checkbox is disabled
   - Verify value doesn't change on save

## Timeline

1. ✅ Frontend code is ready to send `requires_ticket`
2. ⏳ **Waiting on backend**: Uncomment field in EventEditSchema
3. ⏳ Regenerate API client: `pnpm generate:api`
4. ⏳ Test both true/false scenarios
5. ⏳ Deploy

## Alternative: Document the Current Behavior

If backend changes are not feasible immediately, document in the UI that:
- The checkbox controls which UI flow is shown
- All events default to `requires_ticket=true` on the backend
- The setting cannot be changed after creation

This would be a **poor UX** but could be a temporary workaround.
