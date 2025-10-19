# EventStatusBadge Component

A visual indicator that displays the current temporal status of an event with semantic color coding and appropriate iconography.

## Features

- **Automatic Status Detection**: Intelligently determines event status based on timing and capacity
- **Priority System**: Handles multiple conditions with clear priority order
- **Semantic Colors**: Color-coded badges for quick visual scanning
- **Accessible**: WCAG 2.1 AA compliant with proper ARIA attributes
- **Icon Support**: Each status includes a relevant icon
- **Customizable**: Accepts custom className for styling

## Status Types

The badge displays one of the following statuses based on priority:

1. **Cancelled** (Red/Destructive) - Event status is 'rejected'
2. **Full** (Red/Destructive) - Event has reached maximum capacity
3. **Past** (Gray/Secondary) - Event has ended
4. **Ongoing** (Green/Success) - Event is currently happening
5. **Happening Today** (Green/Success) - Event starts today but hasn't started yet
6. **Upcoming** (Blue/Default) - Event is scheduled for the future

## Usage

### Basic Usage

```svelte
<script>
	import { EventStatusBadge } from '$lib/components/events';
	import type { EventDetailSchema } from '$lib/api/generated/types.gen';

	let event: EventDetailSchema = $props();
</script>

<EventStatusBadge {event} />
```

### With Custom Styling

```svelte
<EventStatusBadge event={data.event} class="mb-4" />
<EventStatusBadge event={data.event} class="ml-2 mt-1" />
```

### In an Event Detail Sidebar

```svelte
<aside class="space-y-4">
	<EventStatusBadge event={data.event} />

	<div class="text-sm text-muted-foreground">
		<p>{formatEventDateRange(data.event.start, data.event.end)}</p>
	</div>
</aside>
```

### In an Event Card

```svelte
<article class="event-card">
	<header class="flex items-center justify-between">
		<h3>{event.name}</h3>
		<EventStatusBadge {event} />
	</header>
	<!-- Rest of card content -->
</article>
```

## Props

| Prop    | Type                | Required | Default | Description                     |
| ------- | ------------------- | -------- | ------- | ------------------------------- |
| `event` | `EventDetailSchema` | Yes      | -       | The event object to display     |
| `class` | `string`            | No       | -       | Additional CSS classes to apply |

## Status Determination Logic

The component uses the following logic to determine status (in priority order):

### 1. Cancelled

```typescript
event.status === 'rejected';
```

### 2. Full

```typescript
event.max_attendees > 0 && event.attendee_count >= event.max_attendees;
```

### 3. Past

```typescript
new Date(event.end) < new Date();
```

### 4. Ongoing

```typescript
new Date(event.start) <= new Date() && new Date() <= new Date(event.end);
```

### 5. Happening Today

```typescript
// Event starts on the same calendar day as today
const today = new Date();
const startDate = new Date(event.start);
startDate.toDateString() === today.toDateString();
```

### 6. Upcoming

Default for all future events not matching above conditions.

## Accessibility

The component follows WCAG 2.1 AA guidelines:

- **Semantic HTML**: Uses `<span>` with proper ARIA attributes
- **Role**: `role="status"` for screen readers
- **Live Region**: `aria-live="polite"` for dynamic updates
- **Text-based**: Status is conveyed by text, not just color
- **Icon Hiding**: Icons are decorative with `aria-hidden="true"`
- **Color Contrast**: All color combinations meet 4.5:1 minimum contrast ratio

## Visual Design

### Color Palette

- **Success** (Green): Ongoing, Happening Today
- **Default** (Blue): Upcoming
- **Secondary** (Gray): Past
- **Destructive** (Red): Cancelled, Full

### Icons

Each status includes a relevant icon from `lucide-svelte`:

- **Calendar**: Upcoming, Happening Today
- **Clock**: Ongoing
- **CheckCircle**: Past
- **XCircle**: Cancelled
- **AlertCircle**: Full

## Examples

### Upcoming Event

```svelte
<EventStatusBadge
	event={{
		start: '2025-12-15T18:00:00Z',
		end: '2025-12-15T22:00:00Z',
		status: 'approved',
		max_attendees: 0,
		attendee_count: 25
		// ... other fields
	}}
/>
<!-- Result: Blue badge with Calendar icon showing "Upcoming" -->
```

### Happening Today

```svelte
<EventStatusBadge
	event={{
		start: '2025-12-01T18:00:00Z', // Today at 6 PM
		end: '2025-12-01T22:00:00Z',
		status: 'approved',
		max_attendees: 0,
		attendee_count: 25
		// ... other fields
	}}
/>
<!-- Result: Green badge with Calendar icon showing "Happening Today" -->
```

### Ongoing Event

```svelte
<EventStatusBadge
	event={{
		start: '2025-12-01T18:00:00Z',
		end: '2025-12-01T22:00:00Z', // Currently 8 PM, event is ongoing
		status: 'approved',
		max_attendees: 0,
		attendee_count: 25
		// ... other fields
	}}
/>
<!-- Result: Green badge with Clock icon showing "Ongoing" -->
```

### Full Event

```svelte
<EventStatusBadge
	event={{
		start: '2025-12-15T18:00:00Z',
		end: '2025-12-15T22:00:00Z',
		status: 'approved',
		max_attendees: 50,
		attendee_count: 50 // At capacity
		// ... other fields
	}}
/>
<!-- Result: Red badge with AlertCircle icon showing "Full" -->
```

### Cancelled Event

```svelte
<EventStatusBadge
	event={{
		start: '2025-12-15T18:00:00Z',
		end: '2025-12-15T22:00:00Z',
		status: 'rejected', // Cancelled
		max_attendees: 50,
		attendee_count: 25
		// ... other fields
	}}
/>
<!-- Result: Red badge with XCircle icon showing "Cancelled" -->
```

### Past Event

```svelte
<EventStatusBadge
	event={{
		start: '2025-11-01T18:00:00Z',
		end: '2025-11-01T22:00:00Z', // Event ended
		status: 'approved',
		max_attendees: 50,
		attendee_count: 45
		// ... other fields
	}}
/>
<!-- Result: Gray badge with CheckCircle icon showing "Past" -->
```

## Testing

The component includes comprehensive tests covering:

- All status types
- Priority order
- Accessibility features
- Custom className handling
- Edge cases (unlimited capacity, exact timing boundaries)

Run tests with:

```bash
pnpm test EventStatusBadge
```

## Related Components

- **EventBadges**: Displays multiple badges for user relationship and event type
- **EventDetails**: Shows detailed event information
- **EventHeader**: Event header with title and cover image
