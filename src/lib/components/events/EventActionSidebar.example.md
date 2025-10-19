# EventActionSidebar Component

Unified action center for event attendance management. This is the main sidebar/card that contains all event actions and essential information.

## Features

- **Event Status Badge** - Shows event status (upcoming, ongoing, full, past, cancelled)
- **Attendance Display** - Shows user's attendance status (attending, has ticket, checked in)
- **Primary Action** - Main call-to-action (RSVP, Buy Tickets, Sign In)
- **Secondary Actions** - Manage RSVP or View Ticket buttons
- **Quick Info** - Essential event details (date, location, capacity)
- **Eligibility Status** - Shows why user can't attend (if applicable)

## Props

```typescript
interface Props {
	event: EventDetailSchema; // Event data from API
	userStatus: UserEventStatus | null; // User's RSVP/ticket/eligibility status
	isAuthenticated: boolean; // Whether user is logged in
	variant?: 'sidebar' | 'card'; // Display variant (default: 'sidebar')
	class?: string; // Additional CSS classes
}
```

## Usage

### Basic Usage

```svelte
<script lang="ts">
	import EventActionSidebar from '$lib/components/events/EventActionSidebar.svelte';

	// From your +page.ts or +page.server.ts
	let { data } = $props();
</script>

<EventActionSidebar
	event={data.event}
	userStatus={data.userStatus}
	isAuthenticated={data.isAuthenticated}
/>
```

### Desktop Sidebar with Mobile Card

Typical pattern for event detail pages:

```svelte
<div class="container mx-auto px-4 py-8">
	<div class="grid gap-8 lg:grid-cols-3">
		<!-- Main Content -->
		<div class="lg:col-span-2">
			<!-- Mobile Action Card -->
			<EventActionSidebar
				event={data.event}
				userStatus={data.userStatus}
				isAuthenticated={data.isAuthenticated}
				variant="card"
				class="mb-8 lg:hidden"
			/>

			<!-- Event details, description, etc. -->
			<EventDetails event={data.event} />
		</div>

		<!-- Desktop Sidebar -->
		<aside class="hidden lg:block">
			<EventActionSidebar
				event={data.event}
				userStatus={data.userStatus}
				isAuthenticated={data.isAuthenticated}
				variant="sidebar"
			/>
		</aside>
	</div>
</div>
```

### With Loading State

```svelte
<script lang="ts">
	import EventActionSidebar from '$lib/components/events/EventActionSidebar.svelte';
	import { useQuery } from '@tanstack/svelte-query';
	import { api } from '$lib/api';

	let eventQuery = useQuery({
		queryKey: ['event', eventSlug],
		queryFn: () => api.events.getEvent({ slug: eventSlug })
	});
</script>

{#if $eventQuery.isPending}
	<div class="rounded-lg border bg-card p-8">
		<div class="animate-pulse space-y-4">
			<div class="h-6 w-32 rounded bg-muted"></div>
			<div class="h-12 w-full rounded bg-muted"></div>
		</div>
	</div>
{:else if $eventQuery.isError}
	<div class="rounded-lg border border-destructive bg-destructive/10 p-4">
		<p class="text-destructive">Failed to load event</p>
	</div>
{:else if $eventQuery.data}
	<EventActionSidebar event={$eventQuery.data} {userStatus} {isAuthenticated} />
{/if}
```

## User Status Types

The component handles three types of user status:

### 1. RSVP Status

```typescript
// User has RSVP'd to the event
const rsvpStatus: EventRsvpSchema = {
	id: 'rsvp-123',
	status: 'approved', // or 'pending review' or 'rejected'
	event: 'event-id',
	user: 'user-id',
	created: '2025-01-01T00:00:00Z'
};
```

### 2. Ticket Status

```typescript
// User has purchased a ticket
const ticketStatus: EventTicketSchema = {
	id: 'ticket-123',
	status: 'active', // or 'canceled', 'checked_in', 'refunded'
	event: 'event-id',
	user: 'user-id',
	tier: {
		id: 'tier-id',
		name: 'VIP Ticket',
		price: '50.00',
		currency: 'USD'
	},
	created: '2025-01-01T00:00:00Z',
	check_in_code: 'ABC123'
};
```

### 3. Eligibility Status

```typescript
// User is not eligible (or needs to complete steps)
const eligibilityStatus: EventUserEligibility = {
	allowed: false,
	reason: 'This is a members-only event',
	next_step: 'become_member',
	questionnaires_missing: ['quest-1', 'quest-2'],
	questionnaires_pending_review: ['quest-3'],
	questionnaires_failed: ['quest-4'],
	retry_on: '2025-02-01T00:00:00Z'
};
```

## Variants

### Sidebar Variant (Default)

- Sticky positioning (`sticky top-4`)
- Best for desktop sidebar layouts
- Stays visible as user scrolls

```svelte
<EventActionSidebar {event} {userStatus} {isAuthenticated} variant="sidebar" />
```

### Card Variant

- No sticky positioning
- Full width by default
- Best for mobile layouts or inline use

```svelte
<EventActionSidebar {event} {userStatus} {isAuthenticated} variant="card" />
```

## Behavior Examples

### Unauthenticated User

- Shows "Sign in to attend" button
- Clicking redirects to login with return URL
- No attendance status shown

### Authenticated User - No Status

- Shows "RSVP" button (for free events)
- Shows "Buy Tickets" button (for ticketed events)
- No attendance status shown

### User with Approved RSVP

- Shows "✓ You're attending" with green check
- Shows "Manage RSVP" secondary button
- No primary action button

### User with Active Ticket

- Shows "🎫 You have a ticket"
- Shows ticket tier name (e.g., "VIP Ticket")
- Shows "View Ticket" secondary button
- No primary action button

### User Checked In

- Shows "✓ You're checked in"
- Shows ticket tier name
- Shows "View Ticket" secondary button

### User Not Eligible

- Shows eligibility explanation
- Shows "Eligibility Status" section at bottom
- Shows appropriate action button (e.g., "Join Organization")
- May show missing/pending/failed questionnaires

## Accessibility

### Keyboard Navigation

- All buttons keyboard accessible
- Tab through actions in logical order
- Enter/Space to activate buttons

### Screen Readers

- `<aside>` with `aria-label="Event actions"`
- Status updates with `aria-live="polite"`
- Semantic headings for sections
- Icons marked `aria-hidden="true"`
- Descriptive button labels

### Visual

- High contrast colors
- Clear focus indicators
- Status colors (green for success, yellow for warning)
- Responsive text sizing

## Integration with Other Components

The sidebar integrates these existing components:

1. **EventStatusBadge** - Shows event temporal status
2. **EventQuickInfo** - Displays date, location, capacity, etc.
3. **ActionButton** - Primary CTA with smart state handling
4. **EligibilityStatusDisplay** - Shows detailed eligibility info

## Styling

The component uses Tailwind utility classes and respects the project's design system:

- **Card**: `rounded-lg border bg-card`
- **Attendance Status**: `bg-green-50 text-green-900 dark:bg-green-950/50 dark:text-green-100`
- **Secondary Button**: `border border-input bg-background hover:bg-accent`
- **Spacing**: Consistent `p-4` and `space-y-4` throughout

## Future Enhancements

- Add sharing functionality
- Add calendar export button
- Add "Invite friends" action
- Add event notifications toggle
- Add potluck participation button (if event.potluck_open)

## Related Components

- `EventStatusBadge.svelte` - Event status indicator
- `EventQuickInfo.svelte` - Quick event metadata display
- `ActionButton.svelte` - Smart primary action button
- `EligibilityStatusDisplay.svelte` - Eligibility details
- `EventDetails.svelte` - Full event information
