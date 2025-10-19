# EventRSVP Component

Smart component for managing event RSVP flow with eligibility checks, optimistic updates, and comprehensive error handling.

## Usage

```svelte
<script lang="ts">
  import EventRSVP from '$lib/components/events/EventRSVP.svelte';
  import type { UserEventStatus } from '$lib/utils/eligibility';

  let userStatus: UserEventStatus | null = $props();
  let isAuthenticated = $state(true);
</script>

<EventRSVP
  eventId="event-123"
  eventName="Summer Block Party"
  initialStatus={userStatus}
  {isAuthenticated}
  requiresTicket={false}
/>
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `eventId` | `string` | Yes | Event ID for RSVP submission |
| `eventName` | `string` | Yes | Event name for success message display |
| `initialStatus` | `UserEventStatus \| null` | Yes | User's current status (RSVP, ticket, or eligibility) |
| `isAuthenticated` | `boolean` | Yes | Whether user is logged in |
| `requiresTicket` | `boolean` | Yes | If true, component won't render (ticket events use different flow) |
| `class` | `string` | No | Additional CSS classes |

## Features

### Three States

1. **Not Eligible**: Shows disabled buttons + helpful message + CTA
2. **Already RSVP'd**: Shows confirmation + "Change response" option
3. **Eligible to RSVP**: Shows active Yes/Maybe/No buttons

### Optimistic Updates

Uses TanStack Query for optimistic UI updates - button state changes immediately, then reverts on error.

### Error Handling

- Shows error message with retry option
- Gracefully handles network failures
- Provides user-friendly error messages

### Success Feedback

- "You're going to [Event Name]!" confirmation
- Auto-dismisses after 5 seconds
- Option to change response

### Accessibility

- WCAG 2.1 AA compliant
- Keyboard navigation (Tab, Enter, Space)
- Screen reader friendly (aria-live regions)
- Semantic HTML with proper ARIA labels

## Integration with EventActionSidebar

The component is designed to work seamlessly in the EventActionSidebar:

```svelte
<!-- EventActionSidebar.svelte -->
{#if !isAttending}
  {#if !event.requires_ticket}
    <EventRSVP
      eventId={event.id}
      eventName={event.name}
      initialStatus={userStatus}
      {isAuthenticated}
      requiresTicket={event.requires_ticket}
    />
  {:else}
    <ActionButton ... />
  {/if}
{/if}
```

## API Integration

Calls `POST /api/events/{event_id}/rsvp/{answer}` where answer is:
- `yes` - User is attending
- `maybe` - User might attend
- `no` - User is not attending

Returns `EventRsvpSchema` on success:
```typescript
{
  event_id: string;
  status: 'approved' | 'rejected' | 'pending review';
}
```

Returns `EventUserEligibility` on error (400):
```typescript
{
  allowed: boolean;
  reason?: string;
  next_step?: NextStep;
  // ... questionnaire fields
}
```

## Testing

See `EventRSVP.test.ts` for comprehensive test coverage including:
- Authentication checks
- Eligibility states
- RSVP submission
- Error handling
- Keyboard navigation
- ARIA compliance

## Related Components

- **RSVPButtons**: Presentational component for the three RSVP buttons
- **EventActionSidebar**: Container component that uses EventRSVP
- **ActionButton**: Fallback for ticket-based events
- **EligibilityStatusDisplay**: Shows detailed eligibility info (used for tickets)
