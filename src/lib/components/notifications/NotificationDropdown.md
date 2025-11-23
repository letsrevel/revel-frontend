# NotificationDropdown Component

A production-ready Svelte 5 dropdown menu component for displaying recent notifications in the application header.

## Features

- **Bell Icon Button** - Clean, accessible trigger with unread badge
- **Compact Notification List** - Shows recent notifications (default: 5)
- **Unread Count Badge** - Real-time polling with visual indicator
- **View All Link** - Direct navigation to full notifications page
- **Keyboard Accessible** - Full keyboard navigation support (Tab, Enter, Escape)
- **Mobile Responsive** - Dropdown width adjusts to screen size (max 400px on desktop, 90vw on mobile)
- **Auto-close on Interaction** - Closes when notification is clicked
- **Loading States** - Skeleton loaders while fetching data
- **Empty States** - Friendly messages when no notifications exist
- **Error Handling** - Graceful fallback with retry option

## Props

```typescript
interface Props {
	authToken: string; // Required: JWT token for API authentication
	pollingInterval?: number; // Optional: Badge polling interval in ms (default: 60000)
	maxItems?: number; // Optional: Max notifications in dropdown (default: 5)
	class?: string; // Optional: Additional CSS classes
}
```

## Usage

### Basic Usage

```svelte
<script>
	import { NotificationDropdown } from '$lib/components/notifications';
	import { authStore } from '$lib/stores/auth.svelte';

	let authToken = $derived(authStore.accessToken);
</script>

<NotificationDropdown {authToken} />
```

### In Navigation Header

```svelte
<script>
	import { NotificationDropdown } from '$lib/components/notifications';
	import { authStore } from '$lib/stores/auth.svelte';

	let authToken = $derived(authStore.accessToken);
</script>

<header class="flex items-center justify-between p-4">
	<Logo />
	<nav class="flex items-center gap-4">
		<NotificationDropdown {authToken} />
		<UserMenu />
	</nav>
</header>
```

### Custom Configuration

```svelte
<script>
	import { NotificationDropdown } from '$lib/components/notifications';

	const authToken = 'your-token';
</script>

<!-- Poll every 30 seconds, show 10 notifications -->
<NotificationDropdown {authToken} pollingInterval={30000} maxItems={10} />
```

## Visual Design

### Button Styling
- Ghost variant (transparent background)
- Icon size: 40x40px (touch-friendly)
- Relative positioning for badge overlay
- Bell icon from lucide-svelte

### Dropdown Styling
- Width: 400px on desktop, 90vw on mobile (max 400px)
- Max height: 600px with scrolling if needed
- Aligned to right edge of trigger
- 8px gap below trigger

### Layout Structure
```
┌─────────────────────────────────┐
│ Notifications            [header]│
├─────────────────────────────────┤
│ [Compact Notification List]     │
│                                 │
│ [Loading/Empty/Error State]     │
│                                 │
├─────────────────────────────────┤
│ View all notifications    [footer]│
└─────────────────────────────────┘
```

## Accessibility

### ARIA Attributes
- Button has `aria-label`: "Open notifications"
- Badge has `role="status"` and `aria-live="polite"`
- Unread count announced to screen readers

### Keyboard Navigation
- **Tab** - Focus the bell icon button
- **Enter/Space** - Open dropdown menu
- **Escape** - Close dropdown menu
- **Arrow Keys** - Navigate through notifications (handled by NotificationList)

### Focus Management
- Focus trapped inside dropdown when open
- Returns to trigger button when closed
- All interactive elements keyboard accessible

### Screen Reader Support
- Semantic HTML structure
- Proper ARIA labels and roles
- Live region announcements for count changes
- Descriptive button labels

## Mobile Responsiveness

### Breakpoints
- **Mobile** (< 768px): 90vw width, full touch support
- **Tablet** (≥ 768px): 400px width
- **Desktop** (≥ 1024px): 400px width

### Touch Optimization
- Minimum touch target: 44x44px (bell button)
- Adequate spacing between interactive elements
- Scrollable content area
- Viewport-aware positioning

## Component Integration

### Dependencies
- `NotificationBadge` - Unread count with polling
- `NotificationList` - Compact notification list with pagination
- `shadcn-svelte/dropdown-menu` - Dropdown menu primitives
- `lucide-svelte/Bell` - Bell icon

### Data Flow
```
NotificationDropdown (container)
├── DropdownMenuTrigger (button)
│   ├── Bell icon
│   └── NotificationBadge (polls unread count)
└── DropdownMenuContent (dropdown)
    ├── Header ("Notifications")
    ├── NotificationList (compact mode, fetches notifications)
    └── Footer ("View all" link)
```

### State Management
- **Badge polling** - Handled by NotificationBadge component
- **Notification list** - Handled by NotificationList component
- **Dropdown open/closed** - Managed by DropdownMenu primitive
- **Navigation** - Uses SvelteKit's `goto()` function

## API Integration

### Endpoints Used
- `GET /api/accounts/notifications/unread_count/` - Badge count (via NotificationBadge)
- `GET /api/accounts/notifications/` - Notification list (via NotificationList)

### Query Keys
- `['notifications', 'unread-count']` - Badge count
- `['notifications', { unread_only, notification_type, page }]` - Notification list

### Automatic Invalidation
- Badge count refreshes on visibility change
- Notification list refreshes after status change
- Both use TanStack Query for caching and refetching

## Testing

```bash
pnpm test NotificationDropdown
```

### Test Coverage
- ✅ Renders bell icon button
- ✅ Shows notification badge with unread count
- ✅ Opens dropdown when button is clicked
- ✅ Shows notification list in compact mode
- ✅ Shows "View all notifications" link
- ✅ Navigates to notifications page when "View all" is clicked
- ✅ Is keyboard accessible (Tab, Enter, Escape)
- ✅ Passes custom polling interval to NotificationBadge
- ✅ Passes custom maxItems to NotificationList
- ✅ Has proper ARIA attributes
- ✅ Handles missing authToken gracefully
- ✅ Applies custom className

## Example

See `NotificationDropdown.example.svelte` for a complete example with various configurations.

## Internationalization

Uses Paraglide for i18n. Required message keys:

```typescript
// Message keys
notificationDropdown.openNotifications // "Open notifications"
notificationDropdown.notifications // "Notifications"
notificationDropdown.viewAll // "View all notifications"
```

All messages include fallback values for development.

## Best Practices

### Do's ✅
- Use in authenticated contexts only
- Provide valid authToken
- Place in header/navigation area
- Test keyboard navigation
- Verify mobile responsiveness
- Check accessibility with screen reader

### Don'ts ❌
- Don't use without authentication
- Don't place multiple instances on same page
- Don't override badge polling without reason
- Don't modify internal NotificationList props directly
- Don't forget to handle authToken updates

## Related Components

- `NotificationBadge` - Unread count indicator with polling
- `NotificationList` - Full notification list with filtering and pagination
- `NotificationItem` - Individual notification card
- `NotificationPreferencesForm` - Manage notification preferences

## Troubleshooting

### Badge not showing
- Verify authToken is valid
- Check network tab for API errors
- Ensure user has notifications
- Check `showZero` prop on NotificationBadge (defaults to false)

### Dropdown not opening
- Check if DropdownMenu is properly imported
- Verify button is interactive (not disabled)
- Test keyboard navigation (Enter key)
- Check browser console for errors

### Notifications not loading
- Verify NotificationList is receiving authToken
- Check API endpoint is accessible
- Review network requests in DevTools
- Ensure TanStack Query is configured

### Polling not working
- Check pollingInterval prop (default: 60s)
- Verify tab is visible (polling pauses when hidden)
- Check NotificationBadge component for errors
- Review browser console for warnings

## Performance Considerations

- **Lazy Loading** - Notifications fetch only when dropdown opens
- **Smart Polling** - Badge polling pauses when tab is hidden
- **Query Caching** - TanStack Query caches results
- **Optimistic Updates** - Instant feedback on mark as read
- **Debounced Refetching** - Prevents excessive API calls

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Migration Guide

### From Custom Implementation

```svelte
<!-- Before -->
<button onclick={toggleNotifications}>
  <BellIcon />
  {#if unreadCount > 0}
    <span class="badge">{unreadCount}</span>
  {/if}
</button>
{#if isOpen}
  <div class="dropdown">
    <!-- Custom notification list -->
  </div>
{/if}

<!-- After -->
<NotificationDropdown {authToken} />
```

## License

Same as parent project.
