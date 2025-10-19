# Potluck Coordination System - Technical Specification

## 1. Feature Overview

The potluck coordination system enables event attendees to collaborate on bringing items to events. This feature integrates directly into the existing event detail page, providing a seamless experience for viewing, claiming, and managing potluck items.

## 2. Integration Architecture

### 2.1 Page Structure Integration

The potluck section will be integrated into the existing event detail page at `/events/[org_slug]/[event_slug]` as follows:

```svelte
<!-- In +page.svelte -->
<div class="grid gap-8 lg:grid-cols-3">
	<!-- Left Column: Event Details -->
	<div class="lg:col-span-2">
		<EventDetails event={data.event} />

		<!-- NEW: Potluck Section (conditionally rendered) -->
		{#if data.event.potluck_open}
			<PotluckSection
				event={data.event}
				userStatus={data.userStatus}
				isAuthenticated={data.isAuthenticated}
				class="mt-8"
			/>
		{/if}

		<!-- Organization Info (mobile only) -->
		<div class="mt-8 lg:hidden">
			<OrganizationInfo organization={data.event.organization} />
		</div>
	</div>

	<!-- Right Column: Action Sidebar (desktop only) -->
	<aside class="hidden lg:col-span-1 lg:block">
		<!-- Existing sidebar content -->
	</aside>
</div>
```

### 2.2 Data Loading Strategy

Modify `+page.server.ts` to include potluck data:

```typescript
// In +page.server.ts
import { potluckListPotluckItems7201D243 } from '$lib/api';

export const load: PageServerLoad = async ({ params, locals, fetch }) => {
	// ... existing event loading code ...

	// Fetch potluck items if feature is enabled
	let potluckItems: PotluckItemRetrieveSchema[] = [];
	if (event.potluck_open) {
		try {
			const potluckResponse = await potluckListPotluckItems7201D243({
				fetch,
				path: { event_id: event.id },
				headers
			});

			if (potluckResponse.data) {
				potluckItems = potluckResponse.data;
			}
		} catch (err) {
			// Non-critical: log error but continue
			console.error('Failed to fetch potluck items:', err);
		}
	}

	return {
		event,
		userStatus,
		potluckItems,
		isAuthenticated: !!locals.user,
		// Check if user has organizer permissions
		canManagePotluck: userStatus?.permissions?.manage_potluck ?? false
	};
};
```

## 3. Component Architecture

### 3.1 Component Hierarchy

```
PotluckSection/
├── PotluckSection.svelte (Main container)
├── PotluckItemsList.svelte (Items display)
├── PotluckItem.svelte (Individual item)
├── PotluckItemForm.svelte (Add/Edit form)
├── PotluckCategoryGroup.svelte (Category grouping)
└── PotluckEmptyState.svelte (No items state)
```

### 3.2 PotluckSection Component

**File:** `src/lib/components/potluck/PotluckSection.svelte`

**Responsibilities:**

- Container for all potluck functionality
- Manage section-level state
- Handle permissions
- Coordinate between subcomponents

**Props:**

```typescript
interface Props {
	event: EventDetailSchema;
	userStatus: UserEventStatus | null;
	isAuthenticated: boolean;
	initialItems?: PotluckItemRetrieveSchema[];
	canManagePotluck?: boolean;
	class?: string;
}
```

**Key Features:**

- Collapsible on mobile (expanded by default)
- Real-time updates via polling (5-second interval when expanded)
- Optimistic UI updates
- Error boundary for graceful failures

### 3.3 PotluckItemsList Component

**File:** `src/lib/components/potluck/PotluckItemsList.svelte`

**Responsibilities:**

- Display items grouped by category
- Handle search/filter
- Manage list-level interactions

**Features:**

- Group items by `item_type` enum
- Show claimed vs. available counts per category
- Collapsible categories on mobile
- Search functionality (client-side filtering)

### 3.4 PotluckItem Component

**File:** `src/lib/components/potluck/PotluckItem.svelte`

**Responsibilities:**

- Display individual item
- Handle claim/unclaim actions
- Show edit/delete for organizers

**Visual States:**

- Available (not claimed)
- Claimed by user (highlight with green)
- Claimed by others (grayed out)
- Loading (during claim/unclaim)
- Error state

**Accessibility:**

- `role="article"`
- `aria-label` with item details
- `aria-busy` during loading
- Keyboard accessible actions

## 4. State Management

### 4.1 TanStack Query Setup

**Query Keys:**

```typescript
const QUERY_KEYS = {
	potluckItems: (eventId: string) => ['potluck', 'items', eventId],
	potluckItem: (eventId: string, itemId: string) => ['potluck', 'item', eventId, itemId]
};
```

**Main Query:**

```typescript
// In PotluckSection.svelte
const itemsQuery = createQuery({
	queryKey: QUERY_KEYS.potluckItems(event.id),
	queryFn: () =>
		potluckListPotluckItems7201D243({
			path: { event_id: event.id },
			headers: getAuthHeaders()
		}),
	initialData: initialItems,
	refetchInterval: isExpanded ? 5000 : false, // Poll when visible
	staleTime: 2000
});
```

**Mutations:**

```typescript
// Claim Item Mutation
const claimMutation = createMutation({
	mutationFn: (itemId: string) =>
		potluckClaimPotluckItem2E4F8382({
			path: { event_id: event.id, item_id: itemId },
			headers: getAuthHeaders()
		}),
	onMutate: async (itemId) => {
		// Optimistic update
		await queryClient.cancelQueries({
			queryKey: QUERY_KEYS.potluckItems(event.id)
		});

		const previous = queryClient.getQueryData(QUERY_KEYS.potluckItems(event.id));

		queryClient.setQueryData(
			QUERY_KEYS.potluckItems(event.id),
			(old: PotluckItemRetrieveSchema[]) =>
				old.map((item) =>
					item.id === itemId ? { ...item, is_assigned: true, is_owned: true } : item
				)
		);

		return { previous };
	},
	onError: (err, itemId, context) => {
		// Rollback on error
		queryClient.setQueryData(QUERY_KEYS.potluckItems(event.id), context.previous);

		// Show error toast
		showToast({
			title: 'Failed to claim item',
			description: err.message,
			variant: 'destructive'
		});
	},
	onSettled: () => {
		// Refetch to ensure consistency
		queryClient.invalidateQueries({
			queryKey: QUERY_KEYS.potluckItems(event.id)
		});
	}
});
```

### 4.2 Local State Management

Use Svelte stores for UI state:

```typescript
// In PotluckSection.svelte
let isExpanded = $state(true);
let searchQuery = $state('');
let selectedCategory = $state<ItemTypes | 'all'>('all');
let isAddingItem = $state(false);
let editingItemId = $state<string | null>(null);
```

## 5. User Flows

### 5.1 Attendee Flow

1. **View Items**
   - See all potluck items grouped by category
   - Visual indicators for claimed/available status
   - Search/filter capabilities

2. **Claim Item**
   - Click/tap "Claim" button on available item
   - Optimistic UI update (immediate visual feedback)
   - Success: Item marked as owned
   - Error: Rollback with error message

3. **Unclaim Item**
   - "Unclaim" button on owned items
   - Confirmation dialog on desktop, immediate on mobile
   - Optimistic update with rollback on error

### 5.2 Organizer Flow

1. **Add Item**
   - "Add Item" button (prominent placement)
   - Modal/inline form with fields:
     - Name (required, max 100 chars)
     - Category (required, dropdown)
     - Quantity (optional, max 20 chars)
     - Notes (optional, rich text)
   - Validation before submission
   - Success: Item added to list

2. **Edit Item**
   - Edit button on each item (organizer only)
   - Inline editing on desktop, modal on mobile
   - Same fields as add
   - Optimistic updates

3. **Delete Item**
   - Delete button with confirmation
   - Warning if item is claimed
   - Success: Item removed from list

## 6. Mobile UX Considerations

### 6.1 Layout Adaptations

**Mobile (< 768px):**

- Full-width cards for items
- Collapsible section (accordion pattern)
- Sticky "Add Item" FAB for organizers
- Swipe actions for claim/unclaim
- Bottom sheet for add/edit forms

**Tablet (768px - 1024px):**

- 2-column grid for items
- Side panel for add/edit forms
- Hover states enabled

**Desktop (> 1024px):**

- 3-column grid for items
- Inline editing
- Tooltips for additional info

### 6.2 Touch Interactions

- Large touch targets (min 44x44px)
- Swipe-to-claim gesture (optional)
- Pull-to-refresh for item list
- Haptic feedback on actions (if supported)

## 7. Accessibility Requirements

### 7.1 Screen Reader Support

```svelte
<!-- Item structure -->
<article
	role="article"
	aria-label="{item.name} - {item.is_assigned ? 'Claimed' : 'Available'}"
	aria-busy={isLoading}
>
	<h3 id="item-{item.id}">{item.name}</h3>

	{#if item.is_assigned}
		<div aria-live="polite" aria-atomic="true">
			{#if item.is_owned}
				<span class="sr-only">You claimed this item</span>
			{:else}
				<span class="sr-only">Someone else claimed this item</span>
			{/if}
		</div>
	{/if}

	<button aria-describedby="item-{item.id}" aria-pressed={item.is_owned}>
		{item.is_owned ? 'Unclaim' : 'Claim'}
	</button>
</article>
```

### 7.2 Keyboard Navigation

- Tab through all interactive elements
- Enter/Space to activate buttons
- Escape to close modals/forms
- Arrow keys for category navigation

### 7.3 Announcements

```typescript
// Announce state changes
function announceChange(message: string) {
	const announcement = document.createElement('div');
	announcement.setAttribute('role', 'status');
	announcement.setAttribute('aria-live', 'polite');
	announcement.setAttribute('aria-atomic', 'true');
	announcement.className = 'sr-only';
	announcement.textContent = message;
	document.body.appendChild(announcement);

	setTimeout(() => announcement.remove(), 1000);
}

// Usage
announceChange(`${item.name} claimed successfully`);
```

## 8. API Integration Patterns

### 8.1 Error Handling

```typescript
enum PotluckErrorType {
	ALREADY_CLAIMED = 'ALREADY_CLAIMED',
	NOT_AUTHORIZED = 'NOT_AUTHORIZED',
	ITEM_NOT_FOUND = 'ITEM_NOT_FOUND',
	NETWORK_ERROR = 'NETWORK_ERROR'
}

function handlePotluckError(error: any): string {
	if (error.response?.status === 400) {
		return 'This item has already been claimed by someone else';
	}
	if (error.response?.status === 403) {
		return "You don't have permission to perform this action";
	}
	if (error.response?.status === 404) {
		return 'This item no longer exists';
	}
	return 'Something went wrong. Please try again.';
}
```

### 8.2 Authentication Headers

```typescript
function getAuthHeaders(): HeadersInit {
	// Get token from context or store
	const token = getContext<string>('authToken');
	return token ? { Authorization: `Bearer ${token}` } : {};
}
```

## 9. Performance Optimizations

### 9.1 Data Management

- Initial data from SSR (no loading state on first render)
- Polling only when section is visible
- Debounced search (300ms)
- Virtual scrolling for large lists (>50 items)

### 9.2 Bundle Optimization

- Lazy load form components
- Code splitting for organizer features
- Minimal CSS with Tailwind

## 10. Testing Strategy

### 10.1 Unit Tests

- Component logic (claim/unclaim)
- Permission checks
- Data transformations
- Error handling

### 10.2 Integration Tests

- API mock responses
- Optimistic updates
- Error recovery
- Polling behavior

### 10.3 E2E Tests

- Complete user flows
- Mobile interactions
- Accessibility compliance
- Network failure scenarios

## 11. Implementation Tasks

### Task 1: Core PotluckSection Component (8 hours)

- Create base component structure
- Implement data fetching with TanStack Query
- Add loading/error states
- Set up polling mechanism
- Mobile responsive layout

### Task 2: Item Display Components (6 hours)

- Create PotluckItemsList component
- Implement PotluckItem component
- Add category grouping
- Implement search/filter
- Style with Tailwind

### Task 3: Claim/Unclaim Functionality (4 hours)

- Implement claim mutation
- Implement unclaim mutation
- Add optimistic updates
- Error handling with rollback
- Success/error notifications

### Task 4: Organizer Management UI (6 hours)

- Create PotluckItemForm component
- Add item creation
- Edit functionality
- Delete with confirmation
- Permission checks

### Task 5: Mobile Enhancements (3 hours)

- Touch interactions
- Swipe gestures
- Bottom sheets
- FAB for add action
- Pull-to-refresh

### Task 6: Testing (3 hours)

- Unit tests for components
- Integration tests for API
- E2E test for user flows
- Accessibility audit

## 12. Success Metrics

- Page load time < 2s with potluck data
- Claim/unclaim response < 500ms (perceived)
- Zero accessibility violations (axe-core)
- 100% mobile functionality parity
- <1% error rate in production

## 13. Rollout Strategy

1. Feature flag for gradual rollout
2. Beta test with selected organizations
3. Monitor error rates and performance
4. Full release after 1 week stable beta

## 14. Future Enhancements

- Real-time updates via WebSocket
- Bulk operations for organizers
- Item suggestions based on event type
- Potluck templates for common events
- Export to shopping list
- Integration with recipe suggestions
