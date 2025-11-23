# Notification Components Usage Guide

This directory contains a complete notification system with the following components:

## Components

### 1. NotificationBadge
**Purpose:** Displays unread notification count with real-time polling

**Usage:**
```svelte
<NotificationBadge authToken={token} pollingInterval={60000} />
```

**Props:**
- `authToken` (required) - JWT authentication token
- `pollingInterval` (optional, default: 60000) - Polling frequency in ms
- `showZero` (optional, default: false) - Show badge when count is 0
- `maxCount` (optional, default: 99) - Maximum count before showing "99+"

---

### 2. NotificationList
**Purpose:** Displays paginated list of notifications with filtering

**Usage:**
```svelte
<!-- Full mode (standalone page) -->
<NotificationList authToken={token} />

<!-- Compact mode (dropdown) -->
<NotificationList authToken={token} compact={true} maxItems={5} />
```

**Props:**
- `authToken` (required) - JWT authentication token
- `compact` (optional, default: false) - Compact mode for dropdowns
- `maxItems` (optional, default: 5) - Max items in compact mode
- `class` (optional) - Additional CSS classes

**Features:**
- Filtering (all/unread only)
- Type filtering
- Bulk "mark all as read"
- Pagination (full mode)
- Loading/empty/error states

---

### 3. NotificationDropdown ⭐ NEW
**Purpose:** Complete dropdown menu for header navigation

**Usage:**
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

**Props:**
- `authToken` (required) - JWT authentication token
- `pollingInterval` (optional, default: 60000) - Badge polling frequency
- `maxItems` (optional, default: 5) - Max notifications in dropdown
- `class` (optional) - Additional CSS classes

**Features:**
- Bell icon with unread badge
- Compact notification list
- "View all notifications" link
- Keyboard accessible (Tab, Enter, Escape)
- Mobile responsive
- Auto-closes on interaction

---

### 4. NotificationItem
**Purpose:** Individual notification card (used by NotificationList)

**Usage:**
```svelte
<NotificationItem
  notification={notificationData}
  authToken={token}
  onStatusChange={handleChange}
  compact={false}
/>
```

---

### 5. NotificationPreferencesForm
**Purpose:** Manage notification preferences

**Usage:**
```svelte
<NotificationPreferencesForm authToken={token} />
```

---

## Complete Header Integration Example

```svelte
<script lang="ts">
  import { NotificationDropdown } from '$lib/components/notifications';
  import { Button } from '$lib/components/ui/button';
  import { authStore } from '$lib/stores/auth.svelte';
  import { Menu, X } from 'lucide-svelte';

  let authToken = $derived(authStore.accessToken);
  let mobileMenuOpen = $state(false);
</script>

<header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
  <div class="container flex h-16 items-center justify-between px-4">
    <!-- Logo -->
    <a href="/" class="flex items-center gap-2 font-bold text-xl">
      <img src="/logo.svg" alt="Revel" class="h-8 w-8" />
      <span class="hidden sm:inline">Revel</span>
    </a>

    <!-- Desktop Navigation -->
    <nav class="hidden md:flex items-center gap-6">
      <a href="/events" class="text-sm font-medium hover:underline">
        Events
      </a>
      <a href="/organizations" class="text-sm font-medium hover:underline">
        Organizations
      </a>
    </nav>

    <!-- Right Side Actions -->
    <div class="flex items-center gap-2">
      {#if authToken}
        <!-- Notifications Dropdown -->
        <NotificationDropdown {authToken} />

        <!-- User Menu -->
        <Button variant="ghost" size="icon">
          <img src="/avatar.jpg" alt="Profile" class="h-8 w-8 rounded-full" />
        </Button>
      {:else}
        <!-- Login/Register -->
        <Button variant="ghost" size="sm" href="/login">
          Log in
        </Button>
        <Button size="sm" href="/register">
          Sign up
        </Button>
      {/if}

      <!-- Mobile Menu Toggle -->
      <Button
        variant="ghost"
        size="icon"
        class="md:hidden"
        onclick={() => mobileMenuOpen = !mobileMenuOpen}
        aria-label="Toggle menu"
      >
        {#if mobileMenuOpen}
          <X class="h-5 w-5" />
        {:else}
          <Menu class="h-5 w-5" />
        {/if}
      </Button>
    </div>
  </div>

  <!-- Mobile Menu -->
  {#if mobileMenuOpen}
    <nav class="border-t md:hidden">
      <div class="container py-4 space-y-2">
        <a href="/events" class="block px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg">
          Events
        </a>
        <a href="/organizations" class="block px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg">
          Organizations
        </a>
      </div>
    </nav>
  {/if}
</header>
```

---

## Standalone Notifications Page Example

```svelte
<!-- routes/(auth)/account/notifications/+page.svelte -->
<script lang="ts">
  import { NotificationList } from '$lib/components/notifications';
  import { authStore } from '$lib/stores/auth.svelte';

  let authToken = $derived(authStore.accessToken);
</script>

<div class="container mx-auto px-4 py-8 max-w-4xl">
  <h1 class="text-3xl font-bold mb-8">Notifications</h1>

  <NotificationList {authToken} />
</div>
```

---

## User Settings Page Example

```svelte
<!-- routes/(auth)/account/settings/+page.svelte -->
<script lang="ts">
  import { NotificationPreferencesForm } from '$lib/components/notifications';
  import { authStore } from '$lib/stores/auth.svelte';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';

  let authToken = $derived(authStore.accessToken);
</script>

<div class="container mx-auto px-4 py-8 max-w-4xl">
  <h1 class="text-3xl font-bold mb-8">Account Settings</h1>

  <Tabs defaultValue="profile">
    <TabsList>
      <TabsTrigger value="profile">Profile</TabsTrigger>
      <TabsTrigger value="notifications">Notifications</TabsTrigger>
      <TabsTrigger value="privacy">Privacy</TabsTrigger>
    </TabsList>

    <TabsContent value="profile">
      <!-- Profile settings -->
    </TabsContent>

    <TabsContent value="notifications">
      <NotificationPreferencesForm {authToken} />
    </TabsContent>

    <TabsContent value="privacy">
      <!-- Privacy settings -->
    </TabsContent>
  </Tabs>
</div>
```

---

## API Endpoints

The notification components use the following API endpoints:

- `GET /api/accounts/notifications/unread_count/` - Get unread count (badge)
- `GET /api/accounts/notifications/` - List notifications (with pagination and filters)
- `PATCH /api/accounts/notifications/{id}/mark_read/` - Mark single as read
- `POST /api/accounts/notifications/mark_all_read/` - Mark all as read
- `GET /api/accounts/notifications/preferences/` - Get preferences
- `PATCH /api/accounts/notifications/preferences/` - Update preferences

---

## Internationalization

All components support i18n via Paraglide. See `i18n-messages-needed.md` for required message keys.

All components include fallback English text, so they work even without i18n setup.

---

## Testing

```bash
# Run all notification component tests
pnpm test notifications

# Run specific component tests
pnpm test NotificationBadge
pnpm test NotificationDropdown
pnpm test NotificationList
```

---

## Accessibility

All components are WCAG 2.1 AA compliant:

- ✅ Semantic HTML
- ✅ Keyboard navigation (Tab, Enter, Escape, Arrow keys)
- ✅ ARIA labels and roles
- ✅ Screen reader announcements
- ✅ Focus management
- ✅ Color contrast (4.5:1 minimum)
- ✅ Touch-friendly targets (44x44px minimum)

---

## Component Decision Tree

**Use NotificationDropdown when:**
- Adding notifications to header navigation
- Need a compact, always-visible entry point
- Want bell icon with badge

**Use NotificationList when:**
- Creating a dedicated notifications page
- Need filtering and pagination
- Want bulk actions (mark all as read)

**Use NotificationBadge when:**
- Building custom notification UI
- Only need unread count display
- Want standalone badge indicator

**Use NotificationPreferencesForm when:**
- Building settings/preferences page
- User needs to customize notification types
- Want to enable/disable notification channels

---

## Common Patterns

### Pattern 1: Header with Notifications
```svelte
<NotificationDropdown {authToken} />
```

### Pattern 2: Full Notifications Page
```svelte
<NotificationList {authToken} />
```

### Pattern 3: Custom Dropdown
```svelte
<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    <Button variant="ghost" size="icon" class="relative">
      <Bell />
      <NotificationBadge {authToken} />
    </Button>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content>
    <!-- Custom content -->
    <NotificationList {authToken} compact={true} maxItems={10} />
  </DropdownMenu.Content>
</DropdownMenu.Root>
```

### Pattern 4: Custom Badge Placement
```svelte
<button class="relative">
  <span>Notifications</span>
  <NotificationBadge {authToken} class="ml-2" />
</button>
```

---

## Troubleshooting

### Badge not showing
1. Check `authToken` is valid
2. Verify user has unread notifications
3. Check `showZero` prop (default: false)
4. Review network tab for API errors

### Dropdown not opening
1. Verify DropdownMenu imports are correct
2. Check button is not disabled
3. Test keyboard navigation (Enter key)
4. Check browser console for errors

### Notifications not loading
1. Verify authToken is valid and not expired
2. Check API endpoint is accessible
3. Review network requests in DevTools
4. Ensure TanStack Query is properly configured

### Polling not working
1. Check `pollingInterval` prop (default: 60s)
2. Verify tab is visible (polling pauses when hidden)
3. Check NotificationBadge component logs
4. Review browser console for warnings

---

## Performance Tips

1. **Use compact mode** for dropdowns to limit items
2. **Set reasonable polling intervals** (60s recommended)
3. **Leverage TanStack Query caching** (automatic)
4. **Use lazy loading** for full notification pages
5. **Implement virtual scrolling** for very long lists (future enhancement)

---

## Migration from Old Notification System

```svelte
<!-- Before: Custom implementation -->
<button onclick={toggleNotifications}>
  <BellIcon />
  {#if unreadCount > 0}
    <span class="badge">{unreadCount}</span>
  {/if}
</button>
{#if isOpen}
  <div class="dropdown">
    {#each notifications as notif}
      <div>{notif.message}</div>
    {/each}
  </div>
{/if}

<!-- After: Use NotificationDropdown -->
<NotificationDropdown {authToken} />
```

---

## Future Enhancements

- [ ] Virtual scrolling for large lists
- [ ] Push notifications support
- [ ] Real-time updates via WebSocket
- [ ] Notification grouping by type
- [ ] Rich media notifications (images, videos)
- [ ] Action buttons in notifications
- [ ] Undo "mark as read" action
- [ ] Notification scheduling
- [ ] Notification templates

---

## Support

For issues or questions:
1. Check component documentation (*.md files)
2. Review example files (*.example.svelte)
3. Run tests to verify behavior
4. Check GitHub issues
5. Contact development team
