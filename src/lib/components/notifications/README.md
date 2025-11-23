# Notification Preferences Form Component

A comprehensive, accessible form component for managing user notification preferences in the Revel application.

## Location

`/Users/biagio/repos/letsrevel/revel-frontend/src/lib/components/notifications/NotificationPreferencesForm.svelte`

## Features

- **Svelte 5 Runes** - Uses `$state`, `$derived`, and `$effect` for reactive state management
- **TypeScript** - Fully typed with strict mode
- **Accessibility** - WCAG 2.1 AA compliant with proper ARIA labels and keyboard navigation
- **Mobile-First Design** - Responsive layout that works on all screen sizes
- **TanStack Query Integration** - Optimistic updates and cache invalidation
- **Real-time Validation** - Validates form inputs and provides user feedback
- **Toast Notifications** - Success/error feedback using svelte-sonner

## Props

```typescript
interface Props {
  // Current notification preferences (can be null for initial load)
  preferences: NotificationPreferenceSchema | null;

  // Callback invoked when preferences are successfully saved
  onSave?: (preferences: NotificationPreferenceSchema) => void;

  // Disable all form controls
  disabled?: boolean;

  // JWT authentication token for API calls
  authToken: string;
}
```

## Form Sections

### 1. Master Controls
- **Silence All Notifications** - Toggle to disable all notifications
  - When enabled, disables all other controls
- **Event Reminders** - Toggle to enable/disable event reminder notifications
  - Reminders sent 14, 7, and 1 day before events

### 2. Notification Channels
Multi-select checkboxes for choosing notification delivery methods:
- **In-App** - Show notifications within the application
- **Email** - Receive notifications via email
- **Telegram** - Get notifications on Telegram

**Validation:** At least one channel must be selected when `silence_all` is false.

### 3. Digest Settings
- **Digest Frequency** - Dropdown select with options:
  - Immediate
  - Hourly
  - Daily
  - Weekly
- **Send Time** - Time picker (HH:MM format)
  - Only visible when frequency is "daily" or "weekly"
  - Validates 24-hour time format (e.g., "09:00", "14:30")

### 4. Privacy Settings
- **Show Me On Attendee List** - Dropdown select with options:
  - **Always** - Always display on attendee lists
  - **Never** - Never display on attendee lists
  - **To Members** - Visible to other organization members
  - **To Invitees** - Visible to other invitees at the same event
  - **To Both** - Visible to both members and invitees

## Usage Example

```svelte
<script lang="ts">
  import { NotificationPreferencesForm } from '$lib/components/notifications';
  import { createQuery } from '@tanstack/svelte-query';
  import { notificationpreferenceGetPreferences } from '$lib/api';

  interface Props {
    authToken: string;
  }

  let { authToken }: Props = $props();

  // Fetch current preferences
  const preferencesQuery = createQuery(() => ({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const response = await notificationpreferenceGetPreferences({
        headers: { Authorization: `Bearer ${authToken}` }
      });
      return response.data;
    }
  }));

  function handleSave(updatedPreferences) {
    console.log('Preferences saved:', updatedPreferences);
    // Additional logic after save
  }
</script>

{#if $preferencesQuery.isLoading}
  <p>Loading preferences...</p>
{:else if $preferencesQuery.error}
  <p>Error loading preferences: {$preferencesQuery.error.message}</p>
{:else}
  <NotificationPreferencesForm
    preferences={$preferencesQuery.data}
    {authToken}
    onSave={handleSave}
  />
{/if}
```

## API Integration

The component uses the following API endpoint:

- **PATCH** `/api/api/notification-preferences` - Update notification preferences
  - Function: `notificationpreferenceUpdatePreferences`
  - Body: `UpdateNotificationPreferenceSchema`
  - Response: `NotificationPreferenceSchema`

## State Management

### Local State
- `silenceAll` - Master switch for all notifications
- `eventReminders` - Event reminder toggle
- `enabledChannels` - Array of enabled notification channels
- `digestFrequency` - Selected digest frequency
- `digestSendTime` - Time for digest delivery
- `attendeeListVisibility` - Privacy setting for attendee lists

### Derived State
- `hasChanges` - Boolean indicating if form has unsaved changes
- `isFormDisabled` - Boolean indicating if form controls should be disabled
- `showTimePicker` - Boolean indicating if time picker should be visible
- `validationError` - String with validation error message (or null)

### State Synchronization
The component automatically syncs local state when the `preferences` prop changes using `$effect`.

## Validation Rules

1. **At least one channel required** - When `silence_all` is false, at least one notification channel must be selected
2. **Valid time format** - When time picker is visible, time must match HH:MM format (e.g., "09:00")
3. **Form changes** - Save button only enabled when form has unsaved changes

## Accessibility Features

- Semantic HTML elements (labels, fieldsets, sections)
- Proper ARIA labels on all interactive elements
- Keyboard navigation support (Tab, Space, Enter, Escape)
- Focus indicators on all interactive elements
- Screen reader friendly descriptions
- Disabled state properly communicated
- Error messages associated with form controls
- Color contrast meets WCAG AA standards

### Keyboard Navigation
- **Tab** - Navigate between form controls
- **Space** - Toggle checkboxes
- **Enter** - Submit form / select dropdown options
- **Arrow Keys** - Navigate dropdown options

## Styling

The component uses:
- **shadcn-svelte components** - Button, Card, Checkbox, Input, Label, Select, Separator
- **Tailwind CSS** - Mobile-first responsive utilities
- **Lucide Icons** - Semantic icons for visual feedback

### Mobile-First Responsive Design
```css
/* Action buttons stack on mobile, horizontal on desktop */
.flex-col sm:flex-row

/* Full width buttons on mobile, auto width on desktop */
.w-full sm:w-auto
```

## Testing

The component includes comprehensive tests in `NotificationPreferencesForm.test.ts`:

- Renders all form sections
- Displays current preferences correctly
- Disables controls when silence_all is enabled
- Shows/hides time picker based on digest frequency
- Validates channel selection
- Enables/disables save button based on changes
- Calls onSave callback on successful save
- Resets changes when reset button is clicked
- Is fully keyboard accessible
- Handles disabled prop correctly
- Handles null preferences gracefully

Run tests:
```bash
pnpm test src/lib/components/notifications
```

## Dependencies

- `@tanstack/svelte-query` - Data fetching and caching
- `svelte-sonner` - Toast notifications
- `lucide-svelte` - Icons
- `$lib/components/ui/*` - shadcn-svelte UI components
- `$lib/api` - Auto-generated API client
- `$lib/paraglide/messages.js` - i18n (currently uses hardcoded English)

## Future Enhancements

1. **i18n Support** - Replace hardcoded English text with Paraglide message keys
2. **Advanced Notification Settings** - Add per-notification-type settings using `notification_type_settings`
3. **Telegram Connection Status** - Show if Telegram is connected
4. **Preview Mode** - Allow users to preview notification examples
5. **Timezone Selection** - Let users specify timezone for digest delivery
6. **Quiet Hours** - Add time ranges when notifications should be suppressed

## Notes

- The component handles the `show_me_on_attendee_list` field even though it's not in the `UpdateNotificationPreferenceSchema` type. This is intentional as the backend accepts it.
- Time picker defaults to "09:00" if not specified
- All API calls include proper authentication headers
- Query cache is invalidated on successful mutation to ensure fresh data
