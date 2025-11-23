# Notifications Page

**Route:** `/account/notifications`

## Overview

A dedicated page for viewing and managing user notifications. This page displays all notifications related to events, invitations, and updates.

## Features

- **Full Notification List** - Displays all user notifications with pagination
- **Filtering** - Filter by unread/all and notification type
- **Mark All Read** - Bulk action to mark all notifications as read
- **Settings Link** - Quick access to notification settings
- **Mobile Responsive** - Optimized layout for all screen sizes
- **Accessible** - WCAG 2.1 AA compliant

## Implementation Details

### Rendering Strategy

- **SSR (Server-Side Rendering)** - Initial page load is server-rendered for fast first paint
- **Client-side navigation** - Subsequent navigation uses SvelteKit's client-side routing
- **TanStack Query** - NotificationList component handles client-side data fetching with automatic caching

### Authentication

The `+page.server.ts` checks for user authentication:
- Redirects to `/login?returnUrl=/account/notifications` if not authenticated
- Passes `accessToken` to the client for API requests

### Components Used

- **NotificationList** - Main component from `$lib/components/notifications`
  - Handles data fetching with TanStack Query
  - Implements filtering and pagination
  - Manages mark-as-read functionality
  - Shows loading skeletons and error states

### SEO

- Title: "Notifications - Revel"
- Meta description: "View and manage your event notifications and updates"
- Not indexed by search engines (internal authenticated page)

### i18n Messages

Messages are defined in `messages/{en,de,it}.json`:

```typescript
notificationsPage.pageTitle - "Notifications"
notificationsPage.pageDescription - Full description for meta tag
notificationsPage.title - Page heading
notificationsPage.description - Page subheading
notificationsPage.settingsButton - "Settings" button text
```

## Usage

Navigate to `/account/notifications` when authenticated to view all notifications.

## Related Files

- `/src/lib/components/notifications/NotificationList.svelte` - Main list component
- `/src/lib/components/notifications/NotificationItem.svelte` - Individual notification component
- `/messages/en.json` - English translations
- `/messages/de.json` - German translations
- `/messages/it.json` - Italian translations
