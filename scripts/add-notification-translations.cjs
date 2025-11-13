/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const translations = {
	en: {
		accountSettingsPage: {
			errorNotLoggedIn: 'You must be logged in to view settings.'
		},
		notificationPreferences: {
			masterControls: 'Master Controls',
			silenceAll: 'Silence all notifications',
			silenceAllDescription:
				'Turn off all notifications. When enabled, all other settings will be disabled.',
			eventReminders: 'Event reminders',
			eventRemindersDescription:
				"Receive reminders 14, 7, and 1 day before events you're attending",
			notificationChannels: 'Notification Channels',
			channelInApp: 'In-App',
			channelInAppDescription: 'Show notifications within the application',
			channelEmail: 'Email',
			channelEmailDescription: 'Receive notifications via email',
			channelTelegram: 'Telegram',
			channelTelegramDescription: 'Get notifications on Telegram',
			selectAtLeastOneChannel: 'Please select at least one notification channel',
			digestSettings: 'Digest Settings',
			digestFrequency: 'Digest frequency',
			digestFrequencyImmediate: 'Immediate',
			digestFrequencyHourly: 'Hourly',
			digestFrequencyDaily: 'Daily',
			digestFrequencyWeekly: 'Weekly',
			digestFrequencyDescription: 'Choose how frequently to receive notification digests',
			sendTime: 'Send time',
			sendTimeDescription: 'Time of day to receive your digest (24-hour format)',
			invalidTimeFormat: 'Please enter a valid time in HH:MM format (e.g., 09:00)',
			privacySettings: 'Privacy Settings',
			showMeOnAttendeeList: 'Show me on attendee list',
			visibilityAlways: 'Always display',
			visibilityNever: 'Never display',
			visibilityToMembers: 'Visible to organization members',
			visibilityToInvitees: 'Visible to other invitees at same event',
			visibilityDescription: 'Choose who can see you on event attendee lists',
			advancedSettings: 'Advanced Settings',
			advancedSettingsDescription: 'Configure per-notification-type preferences',
			failedToLoadTypes: 'Failed to load notification types',
			retryLoad: 'Try again',
			noTypesAvailable: 'No notification types available',
			perTypeSettingsTitle: 'Per-notification-type settings:',
			perTypeSettingsDefault:
				'Types marked "Using defaults" follow the global channel settings above',
			perTypeSettingsCustom: 'Types with "Custom" settings use their own channel configuration',
			perTypeSettingsReset: 'Use "Reset" button to revert to default behavior',
			usingDefaults: 'Using defaults',
			customSettings: 'Custom',
			enabled: 'Enabled',
			disabled: 'Disabled',
			noChannels: 'No channels (will not send)',
			channels: 'Channels',
			usingGlobalDefaults: '(using global defaults)',
			resetButton: 'Reset',
			resetAriaLabel: 'Reset {type} to default',
			enableAriaLabel: 'Enable {type} notifications',
			saveChanges: 'Save Changes',
			saving: 'Saving...',
			cancel: 'Cancel',
			saveSuccess: 'Notification preferences updated successfully',
			saveFailed: 'Failed to update preferences: {error}'
		},
		notificationList: {
			ariaLabel: 'Notifications',
			showAll: 'Show all',
			unreadOnly: 'Unread only',
			allTypes: 'All types',
			markAllAsRead: 'Mark all as read',
			markAllReadSuccess: 'All notifications marked as read',
			markAllReadError: 'Failed to mark all as read',
			noUnread: 'No unread notifications',
			empty: 'No notifications yet',
			noUnreadDescription: 'All caught up! No new notifications to read.',
			emptyDescription: "You'll see notifications here when you receive them.",
			errorTitle: 'Failed to load notifications',
			errorMessage: 'Please try again later or contact support if the problem persists.',
			retry: 'Try again',
			previousPage: 'Previous page',
			previous: 'Previous',
			nextPage: 'Next page',
			next: 'Next',
			viewAll: 'View all'
		},
		notificationDropdown: {
			openNotifications: 'Open notifications',
			notifications: 'Notifications',
			viewAll: 'View all notifications'
		}
	},
	de: {
		accountSettingsPage: {
			errorNotLoggedIn: 'Sie müssen angemeldet sein, um die Einstellungen anzuzeigen.'
		},
		notificationPreferences: {
			masterControls: 'Hauptsteuerung',
			silenceAll: 'Alle Benachrichtigungen stummschalten',
			silenceAllDescription:
				'Alle Benachrichtigungen deaktivieren. Wenn aktiviert, werden alle anderen Einstellungen deaktiviert.',
			eventReminders: 'Veranstaltungserinnerungen',
			eventRemindersDescription:
				'Erinnern Sie sich 14, 7 und 1 Tag vor Veranstaltungen, an denen Sie teilnehmen',
			notificationChannels: 'Benachrichtigungskanäle',
			channelInApp: 'In-App',
			channelInAppDescription: 'Benachrichtigungen in der Anwendung anzeigen',
			channelEmail: 'E-Mail',
			channelEmailDescription: 'Benachrichtigungen per E-Mail erhalten',
			channelTelegram: 'Telegram',
			channelTelegramDescription: 'Benachrichtigungen über Telegram erhalten',
			selectAtLeastOneChannel: 'Bitte wählen Sie mindestens einen Benachrichtigungskanal',
			digestSettings: 'Digest-Einstellungen',
			digestFrequency: 'Digest-Häufigkeit',
			digestFrequencyImmediate: 'Sofort',
			digestFrequencyHourly: 'Stündlich',
			digestFrequencyDaily: 'Täglich',
			digestFrequencyWeekly: 'Wöchentlich',
			digestFrequencyDescription:
				'Wählen Sie, wie häufig Sie Benachrichtigungsdigests erhalten möchten',
			sendTime: 'Sendezeit',
			sendTimeDescription: 'Tageszeit für den Erhalt Ihres Digests (24-Stunden-Format)',
			invalidTimeFormat: 'Bitte geben Sie eine gültige Zeit im Format HH:MM ein (z.B. 09:00)',
			privacySettings: 'Datenschutzeinstellungen',
			showMeOnAttendeeList: 'Zeigen Sie mich auf der Teilnehmerliste',
			visibilityAlways: 'Immer anzeigen',
			visibilityNever: 'Nie anzeigen',
			visibilityToMembers: 'Sichtbar für Organisationsmitglieder',
			visibilityToInvitees: 'Sichtbar für andere Eingeladene bei derselben Veranstaltung',
			visibilityDescription: 'Wählen Sie, wer Sie auf Veranstaltungsteilnehmerlisten sehen kann',
			advancedSettings: 'Erweiterte Einstellungen',
			advancedSettingsDescription: 'Einstellungen pro Benachrichtigungstyp konfigurieren',
			failedToLoadTypes: 'Benachrichtigungstypen konnten nicht geladen werden',
			retryLoad: 'Erneut versuchen',
			noTypesAvailable: 'Keine Benachrichtigungstypen verfügbar',
			perTypeSettingsTitle: 'Einstellungen pro Benachrichtigungstyp:',
			perTypeSettingsDefault:
				'Typen mit "Standardwerte verwenden" folgen den globalen Kanaleinstellungen oben',
			perTypeSettingsCustom:
				'Typen mit "Benutzerdefiniert" verwenden ihre eigene Kanalkonfiguration',
			perTypeSettingsReset:
				'Verwenden Sie die Schaltfläche "Zurücksetzen", um das Standardverhalten wiederherzustellen',
			usingDefaults: 'Standardwerte verwenden',
			customSettings: 'Benutzerdefiniert',
			enabled: 'Aktiviert',
			disabled: 'Deaktiviert',
			noChannels: 'Keine Kanäle (wird nicht gesendet)',
			channels: 'Kanäle',
			usingGlobalDefaults: '(globale Standardwerte verwenden)',
			resetButton: 'Zurücksetzen',
			resetAriaLabel: '{type} auf Standard zurücksetzen',
			enableAriaLabel: '{type}-Benachrichtigungen aktivieren',
			saveChanges: 'Änderungen speichern',
			saving: 'Speichern...',
			cancel: 'Abbrechen',
			saveSuccess: 'Benachrichtigungseinstellungen erfolgreich aktualisiert',
			saveFailed: 'Fehler beim Aktualisieren der Einstellungen: {error}'
		},
		notificationList: {
			ariaLabel: 'Benachrichtigungen',
			showAll: 'Alle anzeigen',
			unreadOnly: 'Nur ungelesene',
			allTypes: 'Alle Typen',
			markAllAsRead: 'Alle als gelesen markieren',
			markAllReadSuccess: 'Alle Benachrichtigungen als gelesen markiert',
			markAllReadError: 'Fehler beim Markieren aller als gelesen',
			noUnread: 'Keine ungelesenen Benachrichtigungen',
			empty: 'Noch keine Benachrichtigungen',
			noUnreadDescription: 'Alles erledigt! Keine neuen Benachrichtigungen zum Lesen.',
			emptyDescription: 'Sie werden hier Benachrichtigungen sehen, wenn Sie welche erhalten.',
			errorTitle: 'Benachrichtigungen konnten nicht geladen werden',
			errorMessage:
				'Bitte versuchen Sie es später erneut oder kontaktieren Sie den Support, wenn das Problem weiterhin besteht.',
			retry: 'Erneut versuchen',
			previousPage: 'Vorherige Seite',
			previous: 'Zurück',
			nextPage: 'Nächste Seite',
			next: 'Weiter',
			viewAll: 'Alle anzeigen'
		},
		notificationDropdown: {
			openNotifications: 'Benachrichtigungen öffnen',
			notifications: 'Benachrichtigungen',
			viewAll: 'Alle Benachrichtigungen anzeigen'
		}
	},
	it: {
		accountSettingsPage: {
			errorNotLoggedIn: 'Devi essere loggato per visualizzare le impostazioni.'
		},
		notificationPreferences: {
			masterControls: 'Controlli Principali',
			silenceAll: 'Silenzia tutte le notifiche',
			silenceAllDescription:
				'Disattiva tutte le notifiche. Quando abilitato, tutte le altre impostazioni verranno disabilitate.',
			eventReminders: 'Promemoria eventi',
			eventRemindersDescription:
				'Ricevi promemoria 14, 7 e 1 giorno prima degli eventi a cui partecipi',
			notificationChannels: 'Canali di Notifica',
			channelInApp: 'In-App',
			channelInAppDescription: "Mostra notifiche all'interno dell'applicazione",
			channelEmail: 'Email',
			channelEmailDescription: 'Ricevi notifiche tramite email',
			channelTelegram: 'Telegram',
			channelTelegramDescription: 'Ricevi notifiche su Telegram',
			selectAtLeastOneChannel: 'Seleziona almeno un canale di notifica',
			digestSettings: 'Impostazioni Digest',
			digestFrequency: 'Frequenza digest',
			digestFrequencyImmediate: 'Immediato',
			digestFrequencyHourly: 'Ogni ora',
			digestFrequencyDaily: 'Giornaliero',
			digestFrequencyWeekly: 'Settimanale',
			digestFrequencyDescription: 'Scegli con quale frequenza ricevere i digest delle notifiche',
			sendTime: 'Ora di invio',
			sendTimeDescription: 'Ora del giorno in cui ricevere il digest (formato 24 ore)',
			invalidTimeFormat: 'Inserisci un orario valido nel formato HH:MM (es. 09:00)',
			privacySettings: 'Impostazioni Privacy',
			showMeOnAttendeeList: 'Mostrami nella lista partecipanti',
			visibilityAlways: 'Mostra sempre',
			visibilityNever: 'Non mostrare mai',
			visibilityToMembers: "Visibile ai membri dell'organizzazione",
			visibilityToInvitees: 'Visibile ad altri invitati allo stesso evento',
			visibilityDescription: 'Scegli chi può vederti nelle liste partecipanti agli eventi',
			advancedSettings: 'Impostazioni Avanzate',
			advancedSettingsDescription: 'Configura preferenze per tipo di notifica',
			failedToLoadTypes: 'Impossibile caricare i tipi di notifica',
			retryLoad: 'Riprova',
			noTypesAvailable: 'Nessun tipo di notifica disponibile',
			perTypeSettingsTitle: 'Impostazioni per tipo di notifica:',
			perTypeSettingsDefault:
				'I tipi con "Usa predefiniti" seguono le impostazioni globali dei canali sopra',
			perTypeSettingsCustom:
				'I tipi con "Personalizzato" usano la propria configurazione dei canali',
			perTypeSettingsReset: 'Usa il pulsante "Ripristina" per tornare al comportamento predefinito',
			usingDefaults: 'Usa predefiniti',
			customSettings: 'Personalizzato',
			enabled: 'Abilitato',
			disabled: 'Disabilitato',
			noChannels: 'Nessun canale (non verrà inviato)',
			channels: 'Canali',
			usingGlobalDefaults: '(usa predefiniti globali)',
			resetButton: 'Ripristina',
			resetAriaLabel: 'Ripristina {type} ai valori predefiniti',
			enableAriaLabel: 'Abilita notifiche {type}',
			saveChanges: 'Salva Modifiche',
			saving: 'Salvataggio...',
			cancel: 'Annulla',
			saveSuccess: 'Preferenze notifiche aggiornate con successo',
			saveFailed: 'Impossibile aggiornare le preferenze: {error}'
		},
		notificationList: {
			ariaLabel: 'Notifiche',
			showAll: 'Mostra tutte',
			unreadOnly: 'Solo non lette',
			allTypes: 'Tutti i tipi',
			markAllAsRead: 'Segna tutte come lette',
			markAllReadSuccess: 'Tutte le notifiche segnate come lette',
			markAllReadError: 'Errore nel segnare tutte come lette',
			noUnread: 'Nessuna notifica non letta',
			empty: 'Nessuna notifica ancora',
			noUnreadDescription: 'Tutto fatto! Nessuna nuova notifica da leggere.',
			emptyDescription: 'Vedrai le notifiche qui quando le riceverai.',
			errorTitle: 'Impossibile caricare le notifiche',
			errorMessage: 'Riprova più tardi o contatta il supporto se il problema persiste.',
			retry: 'Riprova',
			previousPage: 'Pagina precedente',
			previous: 'Precedente',
			nextPage: 'Pagina successiva',
			next: 'Successivo',
			viewAll: 'Vedi tutte'
		},
		notificationDropdown: {
			openNotifications: 'Apri notifiche',
			notifications: 'Notifiche',
			viewAll: 'Vedi tutte le notifiche'
		}
	}
};

function addTranslations(lang, translations) {
	const filePath = path.join(__dirname, '..', 'messages', `${lang}.json`);
	const content = fs.readFileSync(filePath, 'utf8');
	const data = JSON.parse(content);

	// Add errorNotLoggedIn to accountSettingsPage if it exists
	if (data.accountSettingsPage && translations.accountSettingsPage) {
		Object.assign(data.accountSettingsPage, translations.accountSettingsPage);
	}

	// Add new sections after accountSettingsPage
	const keys = Object.keys(data);
	const settingsIndex = keys.indexOf('accountSettingsPage');

	if (settingsIndex !== -1) {
		const newData = {};
		let i = 0;

		for (const key of keys) {
			newData[key] = data[key];

			// After accountSettingsPage, insert our new sections
			if (key === 'accountSettingsPage') {
				if (translations.notificationPreferences) {
					newData.notificationPreferences = translations.notificationPreferences;
				}
				if (translations.notificationList) {
					newData.notificationList = translations.notificationList;
				}
				if (translations.notificationDropdown) {
					newData.notificationDropdown = translations.notificationDropdown;
				}
			}
		}

		fs.writeFileSync(filePath, JSON.stringify(newData, null, '\t'));
		console.log(`✅ Added translations to ${lang}.json`);
	} else {
		console.error(`❌ Could not find accountSettingsPage in ${lang}.json`);
	}
}

// Add translations for all languages
Object.keys(translations).forEach((lang) => {
	addTranslations(lang, translations[lang]);
});

console.log('\n✅ All translations added successfully!');
