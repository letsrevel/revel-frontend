# Organization Filter Components

Production-ready Svelte 5 filter components for organization listing pages, following the same patterns as event filters.

## Components

### OrganizationFilters.svelte

Desktop filter sidebar with all organization filtering options.

**Features:**
- Sort by distance, name (A-Z), or name (Z-A)
- Search organizations by name
- Filter by city location
- Filter by tags
- Active filter count indicator
- Clear all filters button
- Mobile-first responsive design
- WCAG 2.1 AA accessible

**Usage:**

```svelte
<script lang="ts">
	import { OrganizationFilters } from '$lib/components/organizations/filters';
	import type { OrganizationFilters as FilterState } from '$lib/utils/organizationFilters';

	let filters = $state<FilterState>({
		orderBy: 'distance',
		page: 1,
		pageSize: 20
	});

	function handleUpdateFilters(updates: Partial<FilterState>): void {
		filters = { ...filters, ...updates };
	}

	function handleClearFilters(): void {
		filters = {
			orderBy: 'distance',
			page: 1,
			pageSize: 20
		};
	}
</script>

<OrganizationFilters
	{filters}
	onUpdateFilters={handleUpdateFilters}
	onClearFilters={handleClearFilters}
/>
```

### MobileOrganizationFilterSheet.svelte

Mobile bottom sheet for organization filtering.

**Features:**
- Slides up from bottom on mobile devices
- All desktop filter options
- Show organization count button
- Backdrop click to close
- Escape key to close
- Body scroll lock when open
- Swipe indicator handle
- WCAG 2.1 AA accessible

**Usage:**

```svelte
<script lang="ts">
	import { MobileOrganizationFilterSheet } from '$lib/components/organizations/filters';
	import type { OrganizationFilters as FilterState } from '$lib/utils/organizationFilters';

	let filters = $state<FilterState>({
		orderBy: 'distance',
		page: 1,
		pageSize: 20
	});

	let isFilterSheetOpen = $state(false);
	let totalCount = $state(0);

	function handleUpdateFilters(updates: Partial<FilterState>): void {
		filters = { ...filters, ...updates };
	}

	function handleClearFilters(): void {
		filters = {
			orderBy: 'distance',
			page: 1,
			pageSize: 20
		};
	}
</script>

<!-- Trigger button -->
<button onclick={() => (isFilterSheetOpen = true)}>
	Open Filters
</button>

<!-- Mobile filter sheet -->
<MobileOrganizationFilterSheet
	{filters}
	{totalCount}
	isOpen={isFilterSheetOpen}
	onUpdateFilters={handleUpdateFilters}
	onClearFilters={handleClearFilters}
	onClose={() => (isFilterSheetOpen = false)}
/>
```

### OrganizationOrderByFilter.svelte

Standalone sort order filter component.

**Options:**
- `distance` - Nearest First (default)
- `name` - A-Z (alphabetical)
- `-name` - Z-A (reverse alphabetical)

**Usage:**

```svelte
<script lang="ts">
	import { OrganizationOrderByFilter } from '$lib/components/organizations/filters';
	import type { OrganizationFilters } from '$lib/utils/organizationFilters';

	let orderBy = $state<OrganizationFilters['orderBy']>('distance');

	function handleChangeOrderBy(value: OrganizationFilters['orderBy']): void {
		orderBy = value;
	}
</script>

<OrganizationOrderByFilter {orderBy} onChangeOrderBy={handleChangeOrderBy} />
```

## Reused Components

These components reuse the following filter components from `events/filters`:

- **SearchInput** - Debounced search input with clear button
- **CityFilter** - City search and selection with autocomplete
- **TagsFilter** - Tag selection with multi-select

## Filter State Management

Use the utility functions from `$lib/utils/organizationFilters`:

```typescript
import {
	parseOrganizationFilters,
	organizationFiltersToParams,
	organizationFiltersToApiParams,
	hasActiveOrganizationFilters,
	countActiveOrganizationFilters,
	clearOrganizationFilters
} from '$lib/utils/organizationFilters';

// Parse URL params to filter state
const filters = parseOrganizationFilters(url.searchParams);

// Convert filters to URL params
const params = organizationFiltersToParams(filters);

// Convert filters to API params
const apiParams = organizationFiltersToApiParams(filters);

// Check if any filters are active
const hasFilters = hasActiveOrganizationFilters(filters);

// Count active filters
const count = countActiveOrganizationFilters(filters);

// Clear all filters
const resetFilters = clearOrganizationFilters();
```

## Accessibility

All components follow WCAG 2.1 AA standards:

- Semantic HTML with proper ARIA labels
- Keyboard navigation (Tab, Enter, Escape)
- Focus indicators on all interactive elements
- Screen reader support
- Color contrast 4.5:1 minimum

## Mobile-First Design

Components are designed mobile-first with responsive breakpoints:

- Mobile: Stacked layout, sheet drawer
- Tablet (md): Sidebar layout
- Desktop (lg): Enhanced spacing

## Testing

Each component has comprehensive test coverage:

- Unit tests with Vitest
- Component tests with @testing-library/svelte
- Accessibility tests
- Keyboard navigation tests

Run tests:

```bash
pnpm test filters
```

## Performance

- Debounced search (300ms)
- Optimized re-renders with Svelte 5 Runes
- No unnecessary API calls
- Efficient filter state management
