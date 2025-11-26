# Backend Changes Needed for Event-Specific Resource Visibility

## Issue #6: Event-Specific Resource Visibility

**User Feedback:** "When adding a resource I am missing the option to make it only visible to attendees of a certain event"

## Current Implementation

### Backend Model (`AdditionalResource`)
Location: `revel-backend/src/events/models/misc.py`

**Current visibility system:**
```python
class VisibilityMixin(models.Model):
    class Visibility(models.TextChoices):
        PUBLIC = "public"          # Everyone can see
        PRIVATE = "private"        # Only invited people can see
        MEMBERS_ONLY = "members-only"  # Only organization members
        STAFF_ONLY = "staff-only"  # Only organization staff
```

**Current relationships:**
```python
class AdditionalResource(TimeStampedModel, VisibilityMixin):
    organization = ForeignKey(Organization)
    event_series = ManyToManyField(EventSeries)  # Can assign to multiple series
    events = ManyToManyField(Event)              # Can assign to multiple events
    display_on_organization_page = BooleanField(default=True)
    # ... resource content fields ...
```

### Current Behavior

The `PRIVATE` visibility option **partially works** for event-specific resources:

```python
# From for_user() queryset (line 64-77):
if related_event_ids:
    private_resources_q = Q(
        visibility=self.model.Visibility.PRIVATE,
        events__id__in=list(related_event_ids)
    )
```

**What works:**
- Resources with `visibility=PRIVATE` AND linked to specific events are only visible to users who:
  - Have an invitation to those events
  - Have a ticket for those events
  - Have RSVP'd YES to those events

**What's confusing/missing:**
1. The UI doesn't clearly explain that `PRIVATE` + event assignment = event-specific visibility
2. The naming is unintuitive ("private" sounds organization-wide, not event-specific)
3. No dedicated visibility option labeled "Event Attendees Only"

---

## Required Backend Changes

### Option A: Add New Visibility Type (Recommended)

Add a new, explicitly named visibility option for event-specific resources.

#### 1. Update VisibilityMixin
File: `revel-backend/src/events/models/mixins.py`

```python
class VisibilityMixin(models.Model):
    class Visibility(models.TextChoices):
        PUBLIC = "public"
        PRIVATE = "private"
        MEMBERS_ONLY = "members-only"
        STAFF_ONLY = "staff-only"
        EVENT_ATTENDEES = "event-attendees"  # NEW: Only attendees of assigned events
```

#### 2. Update AdditionalResource.for_user() Logic
File: `revel-backend/src/events/models/misc.py`

Replace or extend the current `PRIVATE` handling (lines 73-77) with:

```python
# Handle EVENT_ATTENDEES visibility
event_attendees_q = Q()
if related_event_ids:
    event_attendees_q = Q(
        visibility=self.model.Visibility.EVENT_ATTENDEES,
        events__id__in=list(related_event_ids)
    )

# Optionally keep PRIVATE for backwards compatibility
# or migrate existing PRIVATE resources with event links to EVENT_ATTENDEES
private_resources_q = Q()
if related_event_ids:
    private_resources_q = Q(
        visibility=self.model.Visibility.PRIVATE,
        events__id__in=list(related_event_ids)
    )

final_q = role_based_q | event_attendees_q | private_resources_q
```

#### 3. Add Validation
File: `revel-backend/src/events/models/misc.py`

```python
def clean(self) -> None:
    super().clean()

    # Existing validation...

    # New validation: EVENT_ATTENDEES must have at least one event assigned
    if self.visibility == self.Visibility.EVENT_ATTENDEES:
        if not self.events.exists():
            raise ValidationError({
                'visibility': 'Resources with "Event Attendees" visibility must be assigned to at least one event.'
            })
```

#### 4. Migration Script

```python
# migrations/XXXX_add_event_attendees_visibility.py
from django.db import migrations

def migrate_private_to_event_attendees(apps, schema_editor):
    """
    Migrate existing PRIVATE resources that are linked to events
    to the new EVENT_ATTENDEES visibility.
    """
    AdditionalResource = apps.get_model('events', 'AdditionalResource')

    for resource in AdditionalResource.objects.filter(visibility='private'):
        if resource.events.exists():
            resource.visibility = 'event-attendees'
            resource.save()

class Migration(migrations.Migration):
    dependencies = [
        ('events', 'XXXX_previous_migration'),
    ]

    operations = [
        migrations.RunPython(
            migrate_private_to_event_attendees,
            reverse_code=migrations.RunPython.noop
        ),
    ]
```

---

### Option B: Keep PRIVATE, Improve Documentation (Simpler)

**No code changes needed** - just improve UI/UX to clarify that:
- `PRIVATE` visibility + event assignment = event-specific resource
- `PRIVATE` visibility without event assignment = ???

**Issues with this approach:**
- Confusing naming (what is "private" if no events assigned?)
- Need backend validation to require event assignment when `visibility=PRIVATE`
- Less explicit in intent

---

## Frontend Changes (After Backend)

### 1. Update ResourceForm.svelte

```svelte
<select id="visibility" bind:value={visibility}>
    <option value="public">Public - Everyone can see</option>
    <option value="members-only">Members Only - Organization members</option>
    <option value="staff-only">Staff Only - Organization staff</option>
    <option value="event-attendees">Event Attendees Only - Only attendees of assigned events</option>
    <option value="private">Private - Deprecated, use Event Attendees</option>
</select>

{#if visibility === 'event-attendees'}
    <p class="text-sm text-muted-foreground">
        This resource will only be visible to users who have RSVP'd, been invited,
        or purchased tickets to the assigned event(s).
    </p>
{/if}
```

### 2. Add Validation

```typescript
function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    // ... existing validation ...

    if (visibility === 'event-attendees' && selectedEventIds.length === 0) {
        newErrors.events = 'Please assign at least one event for event-specific visibility';
    }

    validationErrors = newErrors;
    return Object.keys(newErrors).length === 0;
}
```

### 3. Update Translations

```json
// messages/en.json
{
    "resourceForm.eventAttendeesOnly": "Event Attendees Only",
    "resourceForm.eventAttendeesHelp": "Only visible to attendees of assigned events",
    "resourceForm.eventAttendeesExplainer": "This resource will be visible to users who have RSVP'd, been invited, or purchased tickets to the selected event(s)."
}
```

---

## Testing Requirements

### Backend Tests

1. **Test event-attendees visibility:**
   ```python
   def test_event_attendees_visibility_for_invited_user():
       """User with invitation sees event-attendees resource"""

   def test_event_attendees_visibility_for_ticketed_user():
       """User with ticket sees event-attendees resource"""

   def test_event_attendees_visibility_for_rsvp_user():
       """User with RSVP YES sees event-attendees resource"""

   def test_event_attendees_visibility_hidden_from_non_attendees():
       """Users without event relationship don't see resource"""
   ```

2. **Test validation:**
   ```python
   def test_event_attendees_requires_event_assignment():
       """Creating EVENT_ATTENDEES resource without events fails"""
   ```

3. **Test migration:**
   ```python
   def test_migration_converts_private_to_event_attendees():
       """Existing PRIVATE resources with events migrate correctly"""
   ```

### Frontend Tests

1. Visibility dropdown includes new option
2. Validation enforces event assignment for `event-attendees`
3. Help text displays for `event-attendees` visibility
4. Form submission includes correct visibility value

---

## Recommended Implementation Approach

**Option A is strongly recommended** because:
1. ✅ Clear, explicit naming ("Event Attendees Only")
2. ✅ Separates concerns (private vs event-specific)
3. ✅ Self-documenting code
4. ✅ Easy to validate (must have events assigned)
5. ✅ Better UX (users understand immediately)

**Migration path:**
1. Add `EVENT_ATTENDEES` to enum
2. Run migration to convert existing `PRIVATE` + events → `EVENT_ATTENDEES`
3. Optionally deprecate `PRIVATE` or repurpose for organization-level private resources
4. Update frontend to use new visibility option
5. Add comprehensive tests

---

## Estimated Effort

**Backend:**
- Add visibility enum value: 5 min
- Update queryset logic: 15 min
- Add validation: 10 min
- Write migration: 20 min
- Write tests: 45 min
- **Total: ~1.5 hours**

**Frontend:**
- Update form UI: 15 min
- Add validation: 10 min
- Add translations (EN, DE, IT): 15 min
- Update help text: 10 min
- Write tests: 30 min
- **Total: ~1.5 hours**

**Overall: ~3 hours** for complete implementation with tests.

---

## Alternative: No Backend Changes

If backend changes are not feasible, we could:
1. Add UI hint: "Use 'Private' visibility and assign events for event-specific resources"
2. Add frontend validation requiring event assignment when `visibility=PRIVATE`
3. Show explanation text when Private is selected

**However, this is a poor UX** and will confuse users. Option A is strongly preferred.
