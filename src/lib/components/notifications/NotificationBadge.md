# NotificationBadge Component

A production-ready Svelte 5 component that displays an unread notification count badge with automatic polling support and intelligent visibility handling.

## Features

- **Automatic Polling**: Fetches unread count at regular intervals
- **Visibility-Aware**: Pauses polling when tab is hidden, resumes when visible
- **Smooth Animations**: Pulse effect when count increases
- **Fully Accessible**: WCAG 2.1 AA compliant with proper ARIA labels
- **Customizable**: Flexible styling and behavior options
- **Type-Safe**: Full TypeScript support with strict mode
- **Performant**: Uses TanStack Query for efficient caching and deduplication

## Installation

The component is already available in the project at:

```
/src/lib/components/notifications/NotificationBadge.svelte
```

## Basic Usage

```svelte
<script>
  import NotificationBadge from '$lib/components/notifications/NotificationBadge.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Bell } from 'lucide-svelte';

  const authToken = 'your-auth-token';
</script>

<Button variant="ghost" size="icon" class="relative">
  <Bell class="h-5 w-5" />
  <NotificationBadge {authToken} />
</Button>
```

## Props

| Prop              | Type                     | Default | Description                                      |
| ----------------- | ------------------------ | ------- | ------------------------------------------------ |
| `authToken`       | `string`                 | -       | **Required.** Authentication token for API calls |
| `pollingInterval` | `number`                 | `60000` | Polling interval in milliseconds (1 minute)      |
| `onCountChange`   | `(count: number) => void` | -       | Callback fired when count changes                |
| `showZero`        | `boolean`                | `false` | Show badge when count is 0                       |
| `maxCount`        | `number`                 | `99`    | Maximum count before showing "99+"               |
| `class`           | `string`                 | -       | Additional CSS classes                           |

## Examples

### Custom Polling Interval

Poll every 30 seconds instead of the default 60 seconds:

```svelte
<NotificationBadge {authToken} pollingInterval={30000} />
```

### Show Zero Count

Display the badge even when there are no unread notifications:

```svelte
<NotificationBadge {authToken} showZero={true} />
```

### Custom Max Count

Show "9+" when count exceeds 9:

```svelte
<NotificationBadge {authToken} maxCount={9} />
```

### Track Count Changes

Execute logic when the notification count changes:

```svelte
<script>
  function handleCountChange(count: number) {
    console.log('New count:', count);

    // Show browser notification
    if (count > 0 && Notification.permission === 'granted') {
      new Notification('New Notification', {
        body: `You have ${count} unread notifications`
      });
    }
  }
</script>

<NotificationBadge {authToken} onCountChange={handleCountChange} />
```

### Custom Styling

Apply custom styles to the badge:

```svelte
<NotificationBadge
  {authToken}
  class="bg-blue-500 text-white -right-2 -top-2 h-6 w-6 text-xs"
/>
```

### In Navigation Header

Typical usage in an application header:

```svelte
<nav class="flex items-center justify-between p-4">
  <span class="font-semibold">My App</span>
  <div class="flex items-center gap-4">
    <a href="/notifications" class="relative">
      <Button variant="ghost" size="icon">
        <Bell class="h-5 w-5" />
        <NotificationBadge {authToken} />
      </Button>
    </a>
  </div>
</nav>
```

## Behavior

### Polling

The badge automatically polls the `/api/api/notifications/unread-count` endpoint at the specified interval. The polling behavior includes:

- **Active Polling**: When tab is visible, polls at `pollingInterval` rate
- **Paused Polling**: When tab is hidden, polling is paused to save resources
- **Immediate Refetch**: When tab becomes visible again, immediately fetches latest count
- **Background Disabled**: Does not poll when tab is in background

### Display Logic

- **Hidden by default**: Badge is hidden when count is 0 (unless `showZero={true}`)
- **Not shown during loading**: Badge doesn't appear while initial fetch is in progress
- **Max count display**: Shows "99+" (or custom maxCount) when count exceeds threshold
- **Exact count**: Shows exact number when below maxCount

### Animation

- **Pulse on increase**: Badge pulses/scales when count increases
- **Smooth transitions**: Fade in/out effects when badge appears/disappears
- **No animation on decrease**: Only animates when count goes up, not down

### Error Handling

- **Silent failures**: Errors are logged to console but don't break UI
- **No retry spam**: Only retries once per failed request
- **Graceful degradation**: Badge simply doesn't appear if API is unreachable

## Accessibility

The component follows WCAG 2.1 AA guidelines:

- **role="status"**: Announces changes to screen readers
- **aria-live="polite"**: Updates announced without interrupting user
- **Descriptive labels**: Clear ARIA labels like "5 unread notifications"
- **Singular/plural handling**: Correct grammar for 1 notification vs many
- **Focus management**: Does not interfere with keyboard navigation

### ARIA Labels

The component provides contextual ARIA labels:

- 0 count: "No unread notifications"
- 1 count: "1 unread notification"
- Multiple: "5 unread notifications"
- Over max: "More than 99 unread notifications"

## Performance

### Optimizations

1. **TanStack Query Caching**: Prevents duplicate requests
2. **Visibility API**: Pauses polling when tab is hidden
3. **Stale Time**: Marks data stale slightly before next poll to ensure fresh data
4. **Retry Limit**: Only retries once to avoid hammering failed endpoints
5. **Conditional Execution**: Doesn't run query if authToken is missing

### Network Impact

With default settings (60-second polling):

- **Active tab**: 1 request per minute
- **Hidden tab**: 0 requests (polling paused)
- **Tab becomes visible**: 1 immediate request + normal polling resumes

## API Integration

The component uses the auto-generated API client:

```typescript
import { notificationUnreadCount } from '$lib/api/generated';

// Expected response:
{
  count: number; // Number of unread notifications
}
```

### Authentication

The component sends the auth token in the Authorization header:

```typescript
headers: { Authorization: `Bearer ${authToken}` }
```

Make sure to pass a valid JWT token for authenticated API calls.

## Positioning

The badge uses absolute positioning and should be placed inside a container with `position: relative`:

```svelte
<!-- ✅ CORRECT: Parent has position relative -->
<div class="relative">
  <Button variant="ghost" size="icon">
    <Bell />
  </Button>
  <NotificationBadge {authToken} />
</div>

<!-- ❌ WRONG: No relative parent -->
<Button variant="ghost" size="icon">
  <Bell />
  <NotificationBadge {authToken} />
</Button>
```

Default position is top-right corner (`-top-1.5 -right-1.5`), but can be customized via the `class` prop.

## Testing

The component includes comprehensive tests. Run them with:

```bash
pnpm test NotificationBadge
```

Test coverage includes:

- ✅ Rendering with different counts
- ✅ Visibility toggle (showZero prop)
- ✅ Max count display ("99+")
- ✅ Custom maxCount values
- ✅ onCountChange callback
- ✅ Authorization header
- ✅ Error handling
- ✅ Accessibility (ARIA labels, roles)
- ✅ Custom className application

## Browser Support

- Modern browsers with ES2020+ support
- Requires `document.visibilityState` API (supported in all modern browsers)
- Gracefully degrades if Visibility API is unavailable

## Troubleshooting

### Badge doesn't appear

1. **Check auth token**: Make sure you're passing a valid `authToken`
2. **Check count**: Badge is hidden when count is 0 (set `showZero={true}` to test)
3. **Check network**: Open DevTools and verify API calls are succeeding
4. **Check console**: Look for error messages

### Badge not updating

1. **Verify polling**: Check Network tab to see if requests are being made
2. **Check tab visibility**: Polling pauses when tab is hidden (by design)
3. **Check backend**: Make sure backend endpoint is returning correct count

### Badge position is wrong

1. **Parent needs `position: relative`**: Wrap badge + icon in a relative container
2. **Use `class` prop**: Override default positioning with custom classes

## Related Components

- **NotificationList**: Full notification list with filtering and pagination
- **NotificationItem**: Individual notification item display

## License

Part of the Revel Frontend project.
