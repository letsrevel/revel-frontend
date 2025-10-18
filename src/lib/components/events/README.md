# Event Components

Event-related UI components for the Revel platform.

## Components

### EventCard

A comprehensive event card component that displays event information in list and grid layouts.

**Features:**

- Two variants: `standard` (desktop grid) and `compact` (mobile list)
- Responsive mobile-first design
- Cover art with fallback to organization logo and gradient
- Badge system showing event status and user relationship
- Full WCAG 2.1 AA accessibility compliance
- Keyboard navigation support
- Optimized images with lazy loading

**Props:**

```typescript
interface EventCardProps {
	event: EventInListSchema; // Full event data from API
	variant?: 'compact' | 'standard'; // Layout variant (default: 'standard')
	userStatus?: UserEventStatus | null; // User's relationship to event (null if not logged in)
	class?: string; // Additional CSS classes
}

interface UserEventStatus {
	attending: boolean;
	organizing: boolean;
	invitationPending: boolean;
	waitlisted: boolean;
}
```

**Usage:**

```svelte
<script lang="ts">
  import { EventCard } from '$lib/components/events';
  import type { EventInListSchema } from '$lib/api/generated/types.gen';

  let event: EventInListSchema = /* ... */;
</script>

<!-- Standard variant (desktop grid) -->
<EventCard {event} variant="standard" />

<!-- Compact variant (mobile list) -->
<EventCard {event} variant="compact" />

<!-- With user status -->
<EventCard
	{event}
	userStatus={{
		attending: true,
		organizing: false,
		invitationPending: false,
		waitlisted: false
	}}
/>

<!-- With custom styling -->
<EventCard {event} class="shadow-xl" />
```

**Standard Variant:**

- Fixed aspect ratio (4:5 including content)
- Vertical layout with image on top
- Shows full information: name, org, date, location, access type, attendee count
- Best for desktop grid layouts (3-4 columns)

**Compact Variant:**

- Horizontal layout on mobile, vertical on tablet+
- Minimal information: name, date, location
- Hides access type and attendee count for space
- Best for mobile list views

**Information Displayed:**

- Event name (truncated to 2 lines)
- Organization name
- Date & time (formatted, e.g., "Fri, Oct 20 • 8:00 PM")
- Location (city name or "TBD")
- Access type (standard variant only)
- Attendee count and spots remaining (standard variant only)
- Status badges (max 2, see EventBadges)

**Image Fallback Strategy:**

1. Use `cover_art` if available
2. Fallback to gradient + organization logo
3. Ultimate fallback: Calendar icon

**Accessibility:**

- Entire card is clickable via overlay link
- Descriptive `aria-label` for screen readers
- Keyboard navigable (Tab to focus, Enter to activate)
- Visible focus indicator (ring)
- All images are decorative (`alt=""`)
- Icons have `aria-hidden="true"`
- Past events have reduced opacity

**Navigation:**

- Links to `/events/{org.slug}/{event.slug}`
- Opens in same window (use Cmd/Ctrl+Click for new tab)

---

### EventBadges

Displays status and user relationship badges for events, with intelligent priority system.

**Features:**

- Maximum 2 badges per event
- Priority-based badge selection
- 5 badge variants for different statuses
- Responsive badge sizing
- Conditional rendering (only shows if badges exist)

**Props:**

```typescript
interface EventBadgesProps {
	event: EventInListSchema; // Full event data
	userStatus?: UserEventStatus | null; // User's relationship to event
	class?: string; // Additional CSS classes
}
```

**Badge Priority System:**

Maximum 2 badges are shown. Priority order:

**Priority 1: User Relationship** (if `userStatus` provided)

- "You're Organizing" - `variant="default"` (purple/primary)
- "You're Attending" - `variant="success"` (green)
- "Invitation Pending" - `variant="secondary"` (yellow/warning)

**Priority 2: Availability/Status**

- "Past Event" - `variant="outline"` (gray) - if event has ended
- "Sold Out" - `variant="destructive"` (red) - if full without waitlist
- "Waitlist Open" - `variant="secondary"` (orange) - if full with waitlist
- "RSVP Closed" - `variant="outline"` (gray) - if RSVP deadline passed

**Priority 3: Access Type** (only if < 2 badges)

- "Members Only" - `variant="secondary"` - if visibility is "members-only"
- "Private" - `variant="secondary"` - if visibility is "private"

**Usage:**

```svelte
<script lang="ts">
  import { EventBadges } from '$lib/components/events';
  import type { EventInListSchema } from '$lib/api/generated/types.gen';

  let event: EventInListSchema = /* ... */;
</script>

<!-- Basic usage -->
<EventBadges {event} />

<!-- With user status -->
<EventBadges
	{event}
	userStatus={{
		attending: false,
		organizing: true,
		invitationPending: false,
		waitlisted: false
	}}
/>

<!-- With custom styling -->
<EventBadges {event} class="absolute right-2 top-2" />
```

**Badge Variants:**

- `default` - Primary color (purple), used for organizing
- `success` - Green, used for attending
- `secondary` - Muted color, used for pending/waitlist/access restrictions
- `destructive` - Red, used for sold out
- `outline` - Border only, used for past events/closed RSVP

**Examples:**

| Event State                         | Badges Shown                       |
| ----------------------------------- | ---------------------------------- |
| User organizing a sold-out event    | "You're Organizing", "Sold Out"    |
| User attending a members-only event | "You're Attending", "Members Only" |
| Past event                          | "Past Event"                       |
| Full event with waitlist open       | "Waitlist Open"                    |
| Private event with RSVP closed      | "Private", "RSVP Closed"           |

---

## Utility Functions

These components rely on utility functions from `$lib/utils/`:

**Date utilities** (`$lib/utils/date.ts`):

- `formatEventDate(dateString)` - Human-readable date
- `formatEventDateForScreenReader(dateString)` - Verbose for screen readers
- `isEventPast(endString)` - Check if event ended
- `isRSVPClosed(rsvpBeforeString)` - Check if RSVP deadline passed

**Event utilities** (`$lib/utils/event.ts`):

- `getEventAccessDisplay(event, userIsMember, userIsStaff)` - Access type string
- `isEventFull(event)` - Check if at capacity
- `getSpotsRemaining(event)` - Spots left or null if unlimited
- `getEventFallbackGradient(eventId)` - Deterministic gradient for fallback

**Styling utilities** (`$lib/utils/cn.ts`):

- `cn(...classes)` - Merge Tailwind classes with proper precedence

---

## Testing

Comprehensive test suites are included:

- `EventBadges.test.ts` - Badge priority system, variants, edge cases
- `EventCard.test.ts` - Rendering, variants, images, accessibility, user status

**Run tests:**

```bash
pnpm test EventCard
pnpm test EventBadges
```

**Test coverage includes:**

- All badge priority levels
- Both component variants
- Image fallback strategies
- Accessibility features (keyboard nav, ARIA, screen readers)
- Edge cases (missing data, extreme values)
- User status integration

---

## Accessibility

Both components are **WCAG 2.1 AA compliant**:

✅ **Keyboard Navigation**

- Tab to focus on card
- Enter to navigate to event details
- Visible focus indicators

✅ **Screen Readers**

- Descriptive labels via `aria-label`
- Proper heading hierarchy
- Icons marked as decorative (`aria-hidden="true"`)
- Semantic HTML (`<article>`, `<h3>`, etc.)

✅ **Color Contrast**

- All text meets 4.5:1 contrast ratio
- Badge variants tested in light and dark modes

✅ **Touch Targets**

- Entire card is clickable (minimum 44x44px on mobile)
- Large hit areas for easy tapping

---

## Responsive Design

**Mobile-First Approach:**

Mobile (< 768px):

- Compact variant: Horizontal layout (image left, content right)
- Standard variant: Vertical layout (image top, content bottom)
- Smaller text sizes
- Compact spacing

Tablet (≥ 768px):

- Both variants: Vertical layout
- Increased padding and spacing
- Larger text sizes

Desktop (≥ 1024px):

- Standard variant best for 3-4 column grids
- Compact variant for sidebar lists

**Recommended Layouts:**

```svelte
<!-- Desktop Grid (3 columns) -->
<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
	{#each events as event}
		<EventCard {event} variant="standard" />
	{/each}
</div>

<!-- Mobile List -->
<div class="flex flex-col gap-4">
	{#each events as event}
		<EventCard {event} variant="compact" />
	{/each}
</div>

<!-- Responsive (compact on mobile, standard on desktop) -->
{#each events as event}
	<EventCard {event} variant={isMobile ? 'compact' : 'standard'} />
{/each}
```

---

## Performance

**Optimizations:**

- Lazy loading images (`loading="lazy"`)
- Reactive computed values with `$derived`
- Minimal re-renders (Svelte 5 Runes)
- Efficient badge calculation (single pass)

**Best Practices:**

- Use `variant="compact"` for long lists (lighter DOM)
- Implement virtual scrolling for 100+ events
- Paginate event lists on server

---

## Dark Mode

Both components support dark mode via Tailwind's `dark:` prefix:

- Badges adjust colors for dark backgrounds
- Text uses semantic color tokens (`text-foreground`, `text-muted-foreground`)
- Borders and backgrounds adapt automatically

No additional configuration needed - works with `mode-watcher` package.

---

## Future Enhancements

Potential improvements:

- [ ] Skeleton loading state component
- [ ] Animated badge transitions
- [ ] Favoriting/bookmarking functionality
- [ ] Share event quick action
- [ ] Calendar export quick action
- [ ] Hover preview popover (desktop only)
- [ ] Intersection Observer for view tracking

---

## Migration Guide

If migrating from a legacy event card:

1. Update imports:

   ```svelte
   import {EventCard} from '$lib/components/events';
   ```

2. Update props (Svelte 5 syntax):

   ```svelte
   <!-- Old -->
   <OldEventCard {event} />

   <!-- New -->
   <EventCard {event} variant="standard" />
   ```

3. Update user status structure:

   ```typescript
   // Old
   { isAttending: true }

   // New
   {
     attending: true,
     organizing: false,
     invitationPending: false,
     waitlisted: false
   }
   ```

4. Test keyboard navigation and screen reader compatibility

---

## Contributing

When modifying these components:

1. Maintain WCAG 2.1 AA compliance
2. Test both variants (standard and compact)
3. Test in light and dark modes
4. Update tests in `.test.ts` files
5. Run `pnpm check` and `pnpm test`
6. Use `svelte-autofixer` for Svelte 5 validation
7. Test on mobile devices (use `pnpm dev` on 0.0.0.0)

---

## Questions?

See `/CLAUDE.md` for project guidelines and subagent documentation.
