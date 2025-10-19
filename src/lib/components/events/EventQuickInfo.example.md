# EventQuickInfo Component

Display critical event metadata in a scannable format with icons. Used in sidebars and quick info panels.

## Basic Usage

```svelte
<script lang="ts">
	import EventQuickInfo from '$lib/components/events/EventQuickInfo.svelte';
	import type { EventDetailSchema } from '$lib/api/generated/types.gen';

	let event: EventDetailSchema = $props();
</script>

<EventQuickInfo {event} />
```

## Variants

### Compact (Default)

Minimal layout, perfect for sidebars:

```svelte
<EventQuickInfo event={data.event} variant="compact" />
```

### Detailed

More spacing and larger text for prominent display:

```svelte
<EventQuickInfo event={data.event} variant="detailed" />
```

## With Custom Styling

```svelte
<EventQuickInfo
	event={data.event}
	variant="compact"
	class="mt-4 rounded-lg border bg-muted/50 p-4"
/>
```

## Information Displayed

The component automatically shows:

- **Date & Time**: Formatted start date/time
- **Location**: City name (with country if available), or "Location TBD"
- **Event Type**: Public, Private, or Members Only
- **Capacity**: Attendance count (if `max_attendees` is set)
  - Shows warning when < 10 spots remain
- **RSVP Deadline**: Relative time to deadline (if `rsvp_before` is set)
  - Shows warning when closing within 24 hours

## Accessibility Features

- Semantic HTML with proper ARIA roles
- Icons marked as decorative (`aria-hidden="true"`)
- `<time>` elements with `datetime` attributes
- Live regions for capacity and deadline warnings
- Keyboard accessible

## Props

```typescript
interface Props {
	event: EventDetailSchema; // Required: Event data from API
	variant?: 'compact' | 'detailed'; // Optional: Display variant (default: 'compact')
	class?: string; // Optional: Additional CSS classes
}
```

## Examples in Context

### Event Detail Sidebar

```svelte
<aside class="space-y-6 lg:w-80">
	<Card>
		<CardHeader>
			<CardTitle>Event Details</CardTitle>
		</CardHeader>
		<CardContent>
			<EventQuickInfo event={data.event} />
		</CardContent>
	</Card>
</aside>
```

### Event Preview Modal

```svelte
<Dialog>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>{event.name}</DialogTitle>
		</DialogHeader>
		<EventQuickInfo {event} variant="detailed" class="my-4" />
		<DialogFooter>
			<Button href="/events/{event.organization.slug}/{event.slug}">View Full Details</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
```

## Warning States

The component automatically highlights:

- **Near Capacity**: Text turns to warning color when < 10 spots remain
- **RSVP Deadline Soon**: Text turns to warning color when < 24 hours remain

These warnings include `aria-live="polite"` for screen reader announcements.
