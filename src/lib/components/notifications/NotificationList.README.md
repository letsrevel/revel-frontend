# NotificationList Component

A comprehensive, production-ready Svelte 5 component for displaying a paginated list of notifications with filtering and bulk actions.

## Features

- **Filtering:** Toggle between all notifications and unread only
- **Type Filtering:** Filter by notification type (if available)
- **Bulk Actions:** Mark all notifications as read
- **Pagination:** Page-based navigation (1, 2, 3, ... Next/Prev)
- **Compact Mode:** Simplified view for dropdowns/sidebars
- **Loading States:** Skeleton loaders while fetching
- **Empty States:** Friendly messages for empty lists
- **Error Handling:** Graceful error display with retry
- **Accessibility:** WCAG 2.1 AA compliant
- **Mobile-First:** Responsive design
- **Real-time Updates:** Automatic refresh after status changes
- **Optimistic Updates:** Instant feedback

## Props

```typescript
interface Props {
  authToken: string;     // Required: JWT token for API authentication
  compact?: boolean;     // Enable compact mode (default: false)
  maxItems?: number;     // Max items in compact mode (default: 5)
  class?: string;        // Additional CSS classes
}
```

## Usage

### Full Mode (standalone page)

```svelte
<script>
  import NotificationList from '$lib/components/notifications/NotificationList.svelte';

  let authToken = $derived(/* get from auth store */);
</script>

<NotificationList {authToken} />
```

### Compact Mode (dropdown)

```svelte
<script>
  import NotificationList from '$lib/components/notifications/NotificationList.svelte';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger
  } from '$lib/components/ui/dropdown-menu';
  import { Button } from '$lib/components/ui/button';
  import { Bell } from 'lucide-svelte';

  let authToken = $derived(/* get from auth store */);
</script>

<DropdownMenu>
  <DropdownMenuTrigger asChild let:builder>
    <Button builders={[builder]} variant="ghost" size="icon">
      <Bell class="h-5 w-5" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent class="w-[400px] max-w-[90vw]">
    <NotificationList {authToken} compact={true} maxItems={5} />
  </DropdownMenuContent>
</DropdownMenu>
```

## API Integration

Uses TanStack Query for data fetching and caching:

- **List Query:** `notificationListNotifications` with pagination and filtering
- **Mutation:** `notificationMarkAllRead` for bulk action
- **Query Key:** `['notifications', { unread_only, notification_type, page }]`

### Query Parameters

- `unread_only` (boolean): Filter to unread notifications only
- `notification_type` (string | null): Filter by notification type
- `page` (number): Page number (starts at 1)
- `page_size` (number): Items per page (20 in full mode, maxItems in compact mode)

## Accessibility

- Semantic HTML with proper ARIA labels
- Keyboard navigation support
- Live region (`aria-live="polite"`) for status updates
- Screen reader announcements for counts
- Focus management after actions
- High contrast support
- All interactive elements keyboard accessible

## Mobile Responsive

- Mobile-first design with Tailwind breakpoints
- Touch-friendly target sizes (min 44x44px)
- Scrollable in compact mode
- Adaptive pagination on small screens

## Internationalization

Uses Paraglide for i18n. See `i18n-messages-needed.md` for required message keys.

All messages include fallback values for development.

## Testing

```bash
pnpm test NotificationList
```

Includes tests for:
- Loading states
- Empty states
- Error handling
- User interactions
- Keyboard navigation
- Accessibility
- API integration

## Example

See `NotificationList.example.svelte` for a complete example page.

## Dependencies

- `@tanstack/svelte-query` - Data fetching and caching
- `$lib/components/ui/*` - shadcn-svelte components
- `lucide-svelte` - Icons
- `svelte-sonner` - Toast notifications
- `$lib/api/generated` - Auto-generated API client
