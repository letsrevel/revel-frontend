# EventCard Component Showcase

Quick reference for all EventCard states and variants.

## Standard Variant States

### Normal Event

```svelte
<EventCard event={normalEvent} variant="standard" />
```

- Shows all information
- Full attendee details
- Access type displayed

### Sold Out Event

```svelte
<EventCard
	event={{
		...normalEvent,
		max_attendees: 50,
		attendee_count: 50,
		waitlist_open: false
	}}
	variant="standard"
/>
```

- "Sold Out" badge (red)
- Shows "0 spots left"

### Waitlist Available

```svelte
<EventCard
	event={{
		...normalEvent,
		max_attendees: 50,
		attendee_count: 50,
		waitlist_open: true
	}}
	variant="standard"
/>
```

- "Waitlist Open" badge (orange)
- Still shows "0 spots left"

### Members Only Event

```svelte
<EventCard
	event={{
		...normalEvent,
		visibility: 'members-only'
	}}
	variant="standard"
/>
```

- "Members Only" badge

### Private Event

```svelte
<EventCard
	event={{
		...normalEvent,
		visibility: 'private'
	}}
	variant="standard"
/>
```

- "Private" badge

### Past Event

```svelte
<EventCard
	event={{
		...normalEvent,
		start: '2020-01-01T18:00:00Z',
		end: '2020-01-01T21:00:00Z'
	}}
	variant="standard"
/>
```

- "Past Event" badge
- Reduced opacity (75%)

### RSVP Closed

```svelte
<EventCard
	event={{
		...normalEvent,
		rsvp_before: '2020-01-01T00:00:00Z'
	}}
	variant="standard"
/>
```

- "RSVP Closed" badge

### User Attending

```svelte
<EventCard
	event={normalEvent}
	variant="standard"
	userStatus={{
		attending: true,
		organizing: false,
		invitationPending: false,
		waitlisted: false
	}}
/>
```

- "You're Attending" badge (green)

### User Organizing

```svelte
<EventCard
	event={normalEvent}
	variant="standard"
	userStatus={{
		attending: false,
		organizing: true,
		invitationPending: false,
		waitlisted: false
	}}
/>
```

- "You're Organizing" badge (primary)

### Invitation Pending

```svelte
<EventCard
	event={normalEvent}
	variant="standard"
	userStatus={{
		attending: false,
		organizing: false,
		invitationPending: true,
		waitlisted: false
	}}
/>
```

- "Invitation Pending" badge (secondary)

## Compact Variant

### Mobile List View

```svelte
<EventCard event={normalEvent} variant="compact" />
```

- Horizontal layout on mobile
- Minimal information
- No access type or attendee count shown

## Image States

### With Cover Art

```svelte
<EventCard
	event={{
		...normalEvent,
		cover_art: 'https://example.com/cover.jpg'
	}}
/>
```

- Displays cover art
- Lazy loading enabled
- Zoom effect on hover

### No Cover Art + Org Logo

```svelte
<EventCard
	event={{
		...normalEvent,
		cover_art: null,
		organization: {
			...normalEvent.organization,
			logo: 'https://example.com/logo.png'
		}
	}}
/>
```

- Gradient background (deterministic)
- Organization logo overlaid at 80% opacity

### No Cover Art + No Logo

```svelte
<EventCard
	event={{
		...normalEvent,
		cover_art: null,
		organization: {
			...normalEvent.organization,
			logo: null
		}
	}}
/>
```

- Gradient background (deterministic)
- Calendar icon as ultimate fallback

## Location States

### With City

```svelte
<EventCard
	event={{
		...normalEvent,
		city: { id: 1, name: 'San Francisco', country: 'US', admin_name: 'CA' }
	}}
/>
```

- Displays city name

### No City

```svelte
<EventCard
	event={{
		...normalEvent,
		city: null
	}}
/>
```

- Displays "TBD"

## Capacity States

### Limited Capacity

```svelte
<EventCard
	event={{
		...normalEvent,
		max_attendees: 50,
		attendee_count: 30
	}}
/>
```

- Shows "30 attendees • 20 spots left"

### Unlimited Capacity

```svelte
<EventCard
	event={{
		...normalEvent,
		max_attendees: 0,
		attendee_count: 100
	}}
/>
```

- Shows "100 attendees" (no spots info)

### At Capacity

```svelte
<EventCard
	event={{
		...normalEvent,
		max_attendees: 50,
		attendee_count: 50
	}}
/>
```

- Shows "50 attendees • 0 spots left"
- "Sold Out" badge (if no waitlist)

## Access Type States

### Free RSVP

```svelte
<EventCard
	event={{
		...normalEvent,
		requires_ticket: false,
		free_for_members: false,
		free_for_staff: false
	}}
/>
```

- Shows "Free RSVP"

### Ticketed

```svelte
<EventCard
	event={{
		...normalEvent,
		requires_ticket: true
	}}
/>
```

- Shows "Ticketed"

### Ticketed (Free for Members)

```svelte
<EventCard
	event={{
		...normalEvent,
		requires_ticket: true,
		free_for_members: true
	}}
/>
```

- Shows "Ticketed (Free for members)"
- TODO: Pass user membership status to show "Free (Member)"

## Combined States

### Organizing + Sold Out

```svelte
<EventCard
	event={{
		...normalEvent,
		max_attendees: 50,
		attendee_count: 50,
		waitlist_open: false
	}}
	userStatus={{
		attending: false,
		organizing: true,
		invitationPending: false,
		waitlisted: false
	}}
/>
```

- Shows 2 badges: "You're Organizing" + "Sold Out"

### Attending + Members Only

```svelte
<EventCard
	event={{
		...normalEvent,
		visibility: 'members-only'
	}}
	userStatus={{
		attending: true,
		organizing: false,
		invitationPending: false,
		waitlisted: false
	}}
/>
```

- Shows 2 badges: "You're Attending" + "Members Only"

### Past Event (always wins)

```svelte
<EventCard
	event={{
		...normalEvent,
		start: '2020-01-01T18:00:00Z',
		end: '2020-01-01T21:00:00Z',
		visibility: 'members-only'
	}}
	userStatus={{
		attending: true,
		organizing: false,
		invitationPending: false,
		waitlisted: false
	}}
/>
```

- Shows 2 badges: "You're Attending" + "Past Event"
- Reduced opacity

## Responsive Breakpoints

- **Mobile (< 768px):**
  - Compact variant: Horizontal layout (image left, content right)
  - Standard variant: Vertical layout
  - Smaller text sizes

- **Tablet (≥ 768px):**
  - Both variants: Vertical layout
  - Increased spacing

- **Desktop (≥ 1024px):**
  - Optimized for 3-column grids
  - Larger touch targets

## Custom Styling Examples

### Featured Event

```svelte
<EventCard event={featuredEvent} class="border-primary shadow-xl" />
```

### Greyed Out

```svelte
<EventCard event={pastEvent} class="opacity-50 grayscale" />
```

### Extra Padding

```svelte
<EventCard {event} class="p-2" />
```

## Grid Layouts

### 3-Column Grid

```svelte
<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
	{#each events as event}
		<EventCard {event} variant="standard" />
	{/each}
</div>
```

### 4-Column Grid

```svelte
<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
	{#each events as event}
		<EventCard {event} variant="standard" />
	{/each}
</div>
```

### List Layout

```svelte
<div class="flex flex-col gap-4">
	{#each events as event}
		<EventCard {event} variant="compact" />
	{/each}
</div>
```

### Masonry-Style (Future)

```svelte
<!-- Requires CSS columns or a library like Masonry.js -->
<div class="columns-1 gap-6 md:columns-2 lg:columns-3">
	{#each events as event}
		<EventCard {event} variant="standard" class="mb-6 break-inside-avoid" />
	{/each}
</div>
```
