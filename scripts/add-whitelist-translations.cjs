const fs = require('fs');
const path = require('path');

const messagesDir = path.join(__dirname, '..', 'messages');

const translations = {
	en: {
		requestWhitelistButton: {
			mustBeLoggedIn: 'You must be logged in to request verification',
			failedToSubmit: 'Failed to submit verification request',
			alreadyRequested: 'You have already requested verification',
			verificationRequested: 'Verification Requested',
			requestSubmitted: 'Verification Request Submitted',
			requestSubmittedBody:
				"Your verification request has been submitted. The organization admins will review it and notify you when it's approved.",
			submitRequestToOrg:
				'Submit a verification request to {organizationName}. This is required because your contact information matches a blocked entry.',
			submitRequest: "Submit a verification request to access this organization's events.",
			messageOptional: 'Message (Optional)',
			messagePlaceholder: 'Explain why you should be verified (e.g., how the organizers know you)...',
			characterCount: '{count}/500 characters',
			failedToSubmitTryAgain: 'Failed to submit request. Please try again.',
			cancel: 'Cancel',
			submitting: 'Submitting...',
			requestVerification: 'Request Verification'
		},
		nextStep: {
			request_whitelist: 'Request Verification',
			wait_for_whitelist_approval: 'Verification Pending'
		},
		eligibility: {
			nextStep: {
				request_whitelist: 'Verification is required to access this organization',
				wait_for_whitelist_approval: 'Your verification request is pending review'
			}
		},
		blacklistPage: {
			title: 'Blacklist & Verification',
			description: 'Manage blocked contacts and verification requests',
			tabBlacklist: 'Blacklist',
			tabWhitelistRequests: 'Verification Requests',
			tabWhitelist: 'Verified Users',
			addEntry: 'Add Entry',
			noEntries: 'No blacklist entries',
			noEntriesDescription: 'Add contacts to block them from your organization',
			noPendingRequests: 'No pending requests',
			noPendingRequestsDescription: 'Verification requests will appear here when users request access',
			noVerifiedUsers: 'No verified users',
			noVerifiedUsersDescription: 'Approved verification requests will appear here',
			searchPlaceholder: 'Search by email, phone, or name...',
			filterAll: 'All',
			filterPending: 'Pending',
			filterApproved: 'Approved',
			filterRejected: 'Rejected',
			entryCreated: 'Blacklist entry created',
			entryUpdated: 'Blacklist entry updated',
			entryDeleted: 'Blacklist entry removed',
			requestApproved: 'Request approved',
			requestRejected: 'Request rejected',
			userRemoved: 'User removed from verified list',
			error: 'An error occurred',
			confirmDelete: 'Are you sure you want to delete this entry?',
			confirmRemove: 'Are you sure you want to remove this user from the verified list?'
		},
		blacklistEntry: {
			linkedUser: 'Linked User',
			noLinkedUser: 'No linked user',
			reason: 'Reason',
			noReason: 'No reason provided',
			createdAt: 'Created',
			edit: 'Edit',
			delete: 'Delete'
		},
		blacklistModal: {
			createTitle: 'Add to Blacklist',
			editTitle: 'Edit Blacklist Entry',
			email: 'Email',
			emailPlaceholder: 'email@example.com',
			telegram: 'Telegram',
			telegramPlaceholder: '@username',
			phone: 'Phone',
			phonePlaceholder: '+1234567890',
			name: 'Name (for reference)',
			namePlaceholder: 'John Doe',
			reason: 'Reason',
			reasonPlaceholder: 'Why is this person being blocked?',
			atLeastOneRequired: 'At least one contact method is required',
			create: 'Add to Blacklist',
			save: 'Save Changes',
			cancel: 'Cancel'
		},
		whitelistRequest: {
			user: 'User',
			message: 'Message',
			noMessage: 'No message provided',
			matchedEntries: 'Matched Blacklist Entries',
			status: 'Status',
			statusPending: 'Pending',
			statusApproved: 'Approved',
			statusRejected: 'Rejected',
			approve: 'Approve',
			reject: 'Reject',
			requestedAt: 'Requested'
		},
		whitelistEntry: {
			verifiedAt: 'Verified',
			remove: 'Remove'
		}
	},
	de: {
		requestWhitelistButton: {
			mustBeLoggedIn: 'Du musst eingeloggt sein, um eine Verifizierung anzufordern',
			failedToSubmit: 'Verifizierungsanfrage konnte nicht gesendet werden',
			alreadyRequested: 'Du hast bereits eine Verifizierung angefordert',
			verificationRequested: 'Verifizierung angefordert',
			requestSubmitted: 'Verifizierungsanfrage gesendet',
			requestSubmittedBody:
				'Deine Verifizierungsanfrage wurde gesendet. Die Organisationsadministratoren werden sie pr\u00fcfen und dich benachrichtigen.',
			submitRequestToOrg:
				'Sende eine Verifizierungsanfrage an {organizationName}. Dies ist erforderlich, da deine Kontaktdaten mit einem gesperrten Eintrag \u00fcbereinstimmen.',
			submitRequest: 'Sende eine Verifizierungsanfrage, um Zugang zu den Events dieser Organisation zu erhalten.',
			messageOptional: 'Nachricht (Optional)',
			messagePlaceholder: 'Erkl\u00e4re, warum du verifiziert werden solltest (z.B. wie die Organisatoren dich kennen)...',
			characterCount: '{count}/500 Zeichen',
			failedToSubmitTryAgain: 'Anfrage konnte nicht gesendet werden. Bitte versuche es erneut.',
			cancel: 'Abbrechen',
			submitting: 'Wird gesendet...',
			requestVerification: 'Verifizierung anfordern'
		},
		nextStep: {
			request_whitelist: 'Verifizierung anfordern',
			wait_for_whitelist_approval: 'Verifizierung ausstehend'
		},
		eligibility: {
			nextStep: {
				request_whitelist: 'Eine Verifizierung ist erforderlich, um auf diese Organisation zuzugreifen',
				wait_for_whitelist_approval: 'Deine Verifizierungsanfrage wird gepr\u00fcft'
			}
		},
		blacklistPage: {
			title: 'Sperrliste & Verifizierung',
			description: 'Verwalte gesperrte Kontakte und Verifizierungsanfragen',
			tabBlacklist: 'Sperrliste',
			tabWhitelistRequests: 'Verifizierungsanfragen',
			tabWhitelist: 'Verifizierte Benutzer',
			addEntry: 'Eintrag hinzuf\u00fcgen',
			noEntries: 'Keine Sperrlisteneintr\u00e4ge',
			noEntriesDescription: 'F\u00fcge Kontakte hinzu, um sie von deiner Organisation zu sperren',
			noPendingRequests: 'Keine ausstehenden Anfragen',
			noPendingRequestsDescription: 'Verifizierungsanfragen werden hier angezeigt, wenn Benutzer Zugang anfordern',
			noVerifiedUsers: 'Keine verifizierten Benutzer',
			noVerifiedUsersDescription: 'Genehmigte Verifizierungsanfragen werden hier angezeigt',
			searchPlaceholder: 'Suche nach E-Mail, Telefon oder Name...',
			filterAll: 'Alle',
			filterPending: 'Ausstehend',
			filterApproved: 'Genehmigt',
			filterRejected: 'Abgelehnt',
			entryCreated: 'Sperrlisteneintrag erstellt',
			entryUpdated: 'Sperrlisteneintrag aktualisiert',
			entryDeleted: 'Sperrlisteneintrag entfernt',
			requestApproved: 'Anfrage genehmigt',
			requestRejected: 'Anfrage abgelehnt',
			userRemoved: 'Benutzer aus der Verifizierungsliste entfernt',
			error: 'Ein Fehler ist aufgetreten',
			confirmDelete: 'Bist du sicher, dass du diesen Eintrag l\u00f6schen m\u00f6chtest?',
			confirmRemove: 'Bist du sicher, dass du diesen Benutzer aus der Verifizierungsliste entfernen m\u00f6chtest?'
		},
		blacklistEntry: {
			linkedUser: 'Verkn\u00fcpfter Benutzer',
			noLinkedUser: 'Kein verkn\u00fcpfter Benutzer',
			reason: 'Grund',
			noReason: 'Kein Grund angegeben',
			createdAt: 'Erstellt',
			edit: 'Bearbeiten',
			delete: 'L\u00f6schen'
		},
		blacklistModal: {
			createTitle: 'Zur Sperrliste hinzuf\u00fcgen',
			editTitle: 'Sperrlisteneintrag bearbeiten',
			email: 'E-Mail',
			emailPlaceholder: 'email@example.com',
			telegram: 'Telegram',
			telegramPlaceholder: '@benutzername',
			phone: 'Telefon',
			phonePlaceholder: '+1234567890',
			name: 'Name (zur Referenz)',
			namePlaceholder: 'Max Mustermann',
			reason: 'Grund',
			reasonPlaceholder: 'Warum wird diese Person gesperrt?',
			atLeastOneRequired: 'Mindestens eine Kontaktmethode ist erforderlich',
			create: 'Zur Sperrliste hinzuf\u00fcgen',
			save: '\u00c4nderungen speichern',
			cancel: 'Abbrechen'
		},
		whitelistRequest: {
			user: 'Benutzer',
			message: 'Nachricht',
			noMessage: 'Keine Nachricht angegeben',
			matchedEntries: '\u00dcbereinstimmende Sperrlisteneintr\u00e4ge',
			status: 'Status',
			statusPending: 'Ausstehend',
			statusApproved: 'Genehmigt',
			statusRejected: 'Abgelehnt',
			approve: 'Genehmigen',
			reject: 'Ablehnen',
			requestedAt: 'Angefordert'
		},
		whitelistEntry: {
			verifiedAt: 'Verifiziert',
			remove: 'Entfernen'
		}
	},
	it: {
		requestWhitelistButton: {
			mustBeLoggedIn: 'Devi essere loggato per richiedere la verifica',
			failedToSubmit: 'Impossibile inviare la richiesta di verifica',
			alreadyRequested: 'Hai gi\u00e0 richiesto la verifica',
			verificationRequested: 'Verifica richiesta',
			requestSubmitted: 'Richiesta di verifica inviata',
			requestSubmittedBody:
				'La tua richiesta di verifica \u00e8 stata inviata. Gli amministratori dell\'organizzazione la esamineranno e ti notificheranno.',
			submitRequestToOrg:
				'Invia una richiesta di verifica a {organizationName}. Questo \u00e8 necessario perch\u00e9 le tue informazioni di contatto corrispondono a una voce bloccata.',
			submitRequest: 'Invia una richiesta di verifica per accedere agli eventi di questa organizzazione.',
			messageOptional: 'Messaggio (Opzionale)',
			messagePlaceholder: 'Spiega perch\u00e9 dovresti essere verificato (es. come gli organizzatori ti conoscono)...',
			characterCount: '{count}/500 caratteri',
			failedToSubmitTryAgain: 'Impossibile inviare la richiesta. Riprova.',
			cancel: 'Annulla',
			submitting: 'Invio in corso...',
			requestVerification: 'Richiedi verifica'
		},
		nextStep: {
			request_whitelist: 'Richiedi verifica',
			wait_for_whitelist_approval: 'Verifica in attesa'
		},
		eligibility: {
			nextStep: {
				request_whitelist: '\u00c8 necessaria la verifica per accedere a questa organizzazione',
				wait_for_whitelist_approval: 'La tua richiesta di verifica \u00e8 in attesa di revisione'
			}
		},
		blacklistPage: {
			title: 'Lista nera e verifica',
			description: 'Gestisci i contatti bloccati e le richieste di verifica',
			tabBlacklist: 'Lista nera',
			tabWhitelistRequests: 'Richieste di verifica',
			tabWhitelist: 'Utenti verificati',
			addEntry: 'Aggiungi voce',
			noEntries: 'Nessuna voce nella lista nera',
			noEntriesDescription: 'Aggiungi contatti per bloccarli dalla tua organizzazione',
			noPendingRequests: 'Nessuna richiesta in sospeso',
			noPendingRequestsDescription: 'Le richieste di verifica appariranno qui quando gli utenti richiederanno l\'accesso',
			noVerifiedUsers: 'Nessun utente verificato',
			noVerifiedUsersDescription: 'Le richieste di verifica approvate appariranno qui',
			searchPlaceholder: 'Cerca per email, telefono o nome...',
			filterAll: 'Tutti',
			filterPending: 'In sospeso',
			filterApproved: 'Approvato',
			filterRejected: 'Rifiutato',
			entryCreated: 'Voce della lista nera creata',
			entryUpdated: 'Voce della lista nera aggiornata',
			entryDeleted: 'Voce della lista nera rimossa',
			requestApproved: 'Richiesta approvata',
			requestRejected: 'Richiesta rifiutata',
			userRemoved: 'Utente rimosso dalla lista dei verificati',
			error: 'Si \u00e8 verificato un errore',
			confirmDelete: 'Sei sicuro di voler eliminare questa voce?',
			confirmRemove: 'Sei sicuro di voler rimuovere questo utente dalla lista dei verificati?'
		},
		blacklistEntry: {
			linkedUser: 'Utente collegato',
			noLinkedUser: 'Nessun utente collegato',
			reason: 'Motivo',
			noReason: 'Nessun motivo fornito',
			createdAt: 'Creato',
			edit: 'Modifica',
			delete: 'Elimina'
		},
		blacklistModal: {
			createTitle: 'Aggiungi alla lista nera',
			editTitle: 'Modifica voce lista nera',
			email: 'Email',
			emailPlaceholder: 'email@example.com',
			telegram: 'Telegram',
			telegramPlaceholder: '@nomeutente',
			phone: 'Telefono',
			phonePlaceholder: '+1234567890',
			name: 'Nome (per riferimento)',
			namePlaceholder: 'Mario Rossi',
			reason: 'Motivo',
			reasonPlaceholder: 'Perch\u00e9 questa persona viene bloccata?',
			atLeastOneRequired: 'Almeno un metodo di contatto \u00e8 richiesto',
			create: 'Aggiungi alla lista nera',
			save: 'Salva modifiche',
			cancel: 'Annulla'
		},
		whitelistRequest: {
			user: 'Utente',
			message: 'Messaggio',
			noMessage: 'Nessun messaggio fornito',
			matchedEntries: 'Voci della lista nera corrispondenti',
			status: 'Stato',
			statusPending: 'In sospeso',
			statusApproved: 'Approvato',
			statusRejected: 'Rifiutato',
			approve: 'Approva',
			reject: 'Rifiuta',
			requestedAt: 'Richiesto'
		},
		whitelistEntry: {
			verifiedAt: 'Verificato',
			remove: 'Rimuovi'
		}
	}
};

// Process each language file
['en', 'de', 'it'].forEach((lang) => {
	const filePath = path.join(messagesDir, `${lang}.json`);
	const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

	// Add translations
	const langTranslations = translations[lang];
	Object.keys(langTranslations).forEach((key) => {
		if (typeof langTranslations[key] === 'object') {
			content[key] = { ...content[key], ...langTranslations[key] };
		} else {
			content[key] = langTranslations[key];
		}
	});

	// Write back
	fs.writeFileSync(filePath, JSON.stringify(content, null, '\t') + '\n');
	console.log(`Updated ${lang}.json`);
});

console.log('Done!');
