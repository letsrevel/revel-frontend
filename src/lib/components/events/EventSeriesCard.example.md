# EventSeriesCard Component

A card component for displaying event series information with support for compact and standard variants.

## Features

- Display series cover art with multi-level fallback (series cover → organization cover → gradient with logo → Users icon)
- Show series name, organization name, and description
- Display tags (up to 3 + more indicator in standard variant)
- Links to series detail page (`/events/{org_slug}/{series_slug}`)
- Image error handling
- Accessible card with screen reader support
- Series indicator badge
- Mobile-first responsive design
- Two variants: compact and standard

## Usage

### Standard Variant (Default)

```svelte
<script lang="ts">
	import { EventSeriesCard } from '$lib/components/events';
	import type { EventSeriesRetrieveSchema } from '$lib/api/generated/types.gen';

	let series: EventSeriesRetrieveSchema = {
		id: 'series-123',
		name: 'Tech Talk Series',
		slug: 'tech-talk-series',
		description: 'Monthly technical talks on web development',
		cover_art: '/media/series/cover.jpg',
		logo: '/media/series/logo.png',
		tags: ['technology', 'web-development', 'learning'],
		organization: {
			id: 'org-456',
			name: 'Tech Community',
			slug: 'tech-community'
			// ... other organization fields
		}
	};
</script>

<EventSeriesCard {series} />
```

### Compact Variant

```svelte
<EventSeriesCard {series} variant="compact" />
```

### With Custom Styling

```svelte
<EventSeriesCard {series} class="max-w-sm" />
```

## Props

| Prop      | Type                        | Default      | Description                |
| --------- | --------------------------- | ------------ | -------------------------- |
| `series`  | `EventSeriesRetrieveSchema` | required     | Event series data from API |
| `variant` | `'compact' \| 'standard'`   | `'standard'` | Card layout variant        |
| `class`   | `string`                    | `undefined`  | Additional CSS classes     |

## Variants

### Standard Variant

- Full-width vertical layout
- Displays description (truncated to 2 lines)
- Shows up to 3 tags with "+X more" indicator
- Best for grid layouts on browse/discover pages

### Compact Variant

- Horizontal layout on mobile, vertical on tablet+
- No description
- No tags
- Smaller image (fixed width on mobile)
- Best for sidebar recommendations or dense lists

## Accessibility

- Uses semantic HTML (`<article>`, `<a>`, `<h3>`)
- Full keyboard navigation support
- Screen reader friendly with descriptive aria-labels
- Focus indicators on interactive elements
- Icons have `aria-hidden="true"`
- Link covers entire card for large click target

## Image Fallback Strategy

1. **Series cover art** (`series.cover_art`)
2. **Organization cover art** (`series.organization.cover_art`)
3. **Gradient with logo**:
   - Series logo (`series.logo`)
   - Organization logo (`series.organization.logo`)
4. **Ultimate fallback**: Users icon

## Responsive Design

Mobile-first approach with breakpoints:

- **Mobile** (< 768px): Compact variant shows horizontal layout
- **Tablet+** (≥ 768px): All variants show vertical layout

## Testing

See `EventSeriesCard.test.ts` for comprehensive test coverage including:

- Rendering with required props
- Variant behavior (compact vs standard)
- Description and tags display logic
- Image fallback handling
- Link structure
- Accessibility features
- Keyboard navigation

## Related Components

- `EventCard` - For individual events
- `OrganizationCard` - For organizations
- `EventBadges` - For event-specific badges
