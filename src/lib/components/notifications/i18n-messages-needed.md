# i18n Messages Needed for Notification Components

The following messages should be added to the Paraglide messages files:

## English (en.json)

```json
{
  "notificationList.ariaLabel": "Notifications",
  "notificationList.showAll": "Show all",
  "notificationList.unreadOnly": "Unread only",
  "notificationList.allTypes": "All types",
  "notificationList.markAllAsRead": "Mark all as read",
  "notificationList.markAllReadSuccess": "All notifications marked as read",
  "notificationList.markAllReadError": "Failed to mark all as read",
  "notificationList.noUnread": "No unread notifications",
  "notificationList.empty": "No notifications yet",
  "notificationList.noUnreadDescription": "All caught up! No new notifications to read.",
  "notificationList.emptyDescription": "You'll see notifications here when you receive them.",
  "notificationList.errorTitle": "Failed to load notifications",
  "notificationList.errorMessage": "Please try again later or contact support if the problem persists.",
  "notificationList.retry": "Try again",
  "notificationList.previousPage": "Previous page",
  "notificationList.previous": "Previous",
  "notificationList.nextPage": "Next page",
  "notificationList.next": "Next",
  "notificationList.viewAll": "View all",
  "notificationDropdown.openNotifications": "Open notifications",
  "notificationDropdown.notifications": "Notifications",
  "notificationDropdown.viewAll": "View all notifications"
}
```

## German (de.json)

```json
{
  "notificationList.ariaLabel": "Benachrichtigungen",
  "notificationList.showAll": "Alle anzeigen",
  "notificationList.unreadOnly": "Nur ungelesene",
  "notificationList.allTypes": "Alle Typen",
  "notificationList.markAllAsRead": "Alle als gelesen markieren",
  "notificationList.markAllReadSuccess": "Alle Benachrichtigungen als gelesen markiert",
  "notificationList.markAllReadError": "Fehler beim Markieren aller als gelesen",
  "notificationList.noUnread": "Keine ungelesenen Benachrichtigungen",
  "notificationList.empty": "Noch keine Benachrichtigungen",
  "notificationList.noUnreadDescription": "Alles erledigt! Keine neuen Benachrichtigungen zum Lesen.",
  "notificationList.emptyDescription": "Sie werden hier Benachrichtigungen sehen, wenn Sie welche erhalten.",
  "notificationList.errorTitle": "Benachrichtigungen konnten nicht geladen werden",
  "notificationList.errorMessage": "Bitte versuchen Sie es später erneut oder kontaktieren Sie den Support, wenn das Problem weiterhin besteht.",
  "notificationList.retry": "Erneut versuchen",
  "notificationList.previousPage": "Vorherige Seite",
  "notificationList.previous": "Zurück",
  "notificationList.nextPage": "Nächste Seite",
  "notificationList.next": "Weiter",
  "notificationList.viewAll": "Alle anzeigen",
  "notificationDropdown.openNotifications": "Benachrichtigungen öffnen",
  "notificationDropdown.notifications": "Benachrichtigungen",
  "notificationDropdown.viewAll": "Alle Benachrichtigungen anzeigen"
}
```

## Italian (it.json)

```json
{
  "notificationList.ariaLabel": "Notifiche",
  "notificationList.showAll": "Mostra tutte",
  "notificationList.unreadOnly": "Solo non lette",
  "notificationList.allTypes": "Tutti i tipi",
  "notificationList.markAllAsRead": "Segna tutte come lette",
  "notificationList.markAllReadSuccess": "Tutte le notifiche segnate come lette",
  "notificationList.markAllReadError": "Errore nel segnare tutte come lette",
  "notificationList.noUnread": "Nessuna notifica non letta",
  "notificationList.empty": "Nessuna notifica ancora",
  "notificationList.noUnreadDescription": "Tutto fatto! Nessuna nuova notifica da leggere.",
  "notificationList.emptyDescription": "Vedrai le notifiche qui quando le riceverai.",
  "notificationList.errorTitle": "Impossibile caricare le notifiche",
  "notificationList.errorMessage": "Riprova più tardi o contatta il supporto se il problema persiste.",
  "notificationList.retry": "Riprova",
  "notificationList.previousPage": "Pagina precedente",
  "notificationList.previous": "Precedente",
  "notificationList.nextPage": "Pagina successiva",
  "notificationList.next": "Successivo",
  "notificationList.viewAll": "Vedi tutte",
  "notificationDropdown.openNotifications": "Apri notifiche",
  "notificationDropdown.notifications": "Notifiche",
  "notificationDropdown.viewAll": "Vedi tutte le notifiche"
}
```

## Usage in Component

The component already uses these messages with fallback values:

```typescript
m['notificationList.ariaLabel']?.() || 'Notifications'
```

This ensures the component works even if the messages haven't been added to the i18n files yet.
