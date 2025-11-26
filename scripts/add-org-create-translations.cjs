const fs = require('fs');
const path = require('path');

// Translation keys to add
const translations = {
	en: {
		// User Menu
		'userMenu.createOrganization': 'Create Organization',

		// Dashboard
		'dashboard.createOrganizationButton': 'Create Organization',

		// Home Page - Start Organizing
		'learnMore.startOrganizingTitle': 'Start Organizing Events',
		'learnMore.startOrganizingDescription':
			'Create your organization and start hosting amazing events for your community.',
		'learnMore.startOrganizing': 'Start Organizing',
		'learnMore.startOrganizingNote': 'Free to get started. No credit card required.',

		// Organization Create Page
		'orgCreate.pageTitle': 'Create Organization',
		'orgCreate.pageDescription': 'Create your organization to start hosting events',
		'orgCreate.title': 'Create Your Organization',
		'orgCreate.subtitle':
			'Start your journey as an event organizer by creating your organization.',

		// Form Fields
		'orgCreate.form.name': 'Organization Name',
		'orgCreate.form.namePlaceholder': 'Enter your organization name',
		'orgCreate.form.nameHint': 'This name will be visible to all users browsing events.',

		'orgCreate.form.contactEmail': 'Contact Email',
		'orgCreate.form.contactEmailPlaceholder': 'contact@example.com',
		'orgCreate.form.contactEmailVerificationNeeded':
			"This email will need to be verified. We'll send you a verification link.",
		'orgCreate.form.contactEmailAutoVerified':
			'Using your verified email - no additional verification needed.',

		'orgCreate.form.description': 'Description (Optional)',
		'orgCreate.form.descriptionPlaceholder': 'Tell people about your organization...',
		'orgCreate.form.descriptionHint':
			'A brief description of your organization and what events you host.',

		// Actions
		'orgCreate.form.create': 'Create Organization',
		'orgCreate.form.creating': 'Creating...',
		'orgCreate.form.error': 'Failed to create organization',

		// Warnings
		'orgCreate.alreadyOwner': 'You already own an organization',
		'orgCreate.alreadyOwnerDescription':
			'Each user can only own one organization. You can manage your existing organization from the dashboard.',
		'orgCreate.backToDashboard': 'Back to Dashboard',

		'orgCreate.emailNotVerified': 'Email verification required',
		'orgCreate.emailNotVerifiedDescription':
			'You must verify your email address before creating an organization. Please check your inbox for the verification email.',
		'orgCreate.verifyEmail': 'Go to Settings',

		// Contact Email Verification Page
		'orgVerifyContactEmail.successTitle': 'Email Verified',
		'orgVerifyContactEmail.failureTitle': 'Verification Failed',
		'orgVerifyContactEmail.pageDescription': 'Organization contact email verification',

		'orgVerifyContactEmail.verifying': 'Verifying your email...',
		'orgVerifyContactEmail.verifyingDescription': 'Please wait while we verify your contact email.',

		'orgVerifyContactEmail.success': 'Contact Email Verified!',
		'orgVerifyContactEmail.successDescription':
			'The contact email for {organizationName} has been successfully verified.',

		'orgVerifyContactEmail.failure': 'Verification Failed',
		'orgVerifyContactEmail.failureDescription':
			'We could not verify your contact email. The link may have expired or is invalid.',

		'orgVerifyContactEmail.linkExpired': 'The verification link may have expired or is invalid.',
		'orgVerifyContactEmail.goToSettings': 'Go to Organization Settings',
		'orgVerifyContactEmail.goToDashboard': 'Go to Dashboard',
		'orgVerifyContactEmail.backToLogin': 'Back to Login'
	},

	de: {
		// User Menu
		'userMenu.createOrganization': 'Organisation erstellen',

		// Dashboard
		'dashboard.createOrganizationButton': 'Organisation erstellen',

		// Home Page - Start Organizing
		'learnMore.startOrganizingTitle': 'Beginne mit der Organisation von Veranstaltungen',
		'learnMore.startOrganizingDescription':
			'Erstelle deine Organisation und beginne, großartige Veranstaltungen für deine Community zu veranstalten.',
		'learnMore.startOrganizing': 'Jetzt organisieren',
		'learnMore.startOrganizingNote':
			'Kostenlos starten. Keine Kreditkarte erforderlich.',

		// Organization Create Page
		'orgCreate.pageTitle': 'Organisation erstellen',
		'orgCreate.pageDescription':
			'Erstelle deine Organisation, um mit der Veranstaltung von Events zu beginnen',
		'orgCreate.title': 'Organisation erstellen',
		'orgCreate.subtitle':
			'Beginne deine Reise als Veranstalter, indem du deine Organisation erstellst.',

		// Form Fields
		'orgCreate.form.name': 'Organisationsname',
		'orgCreate.form.namePlaceholder': 'Gib den Namen deiner Organisation ein',
		'orgCreate.form.nameHint': 'Dieser Name wird allen Nutzern angezeigt, die Events durchsuchen.',

		'orgCreate.form.contactEmail': 'Kontakt-E-Mail',
		'orgCreate.form.contactEmailPlaceholder': 'kontakt@beispiel.de',
		'orgCreate.form.contactEmailVerificationNeeded':
			'Diese E-Mail muss verifiziert werden. Wir senden dir einen Bestätigungslink.',
		'orgCreate.form.contactEmailAutoVerified':
			'Deine verifizierte E-Mail wird verwendet - keine zusätzliche Verifizierung erforderlich.',

		'orgCreate.form.description': 'Beschreibung (Optional)',
		'orgCreate.form.descriptionPlaceholder': 'Erzähle den Leuten von deiner Organisation...',
		'orgCreate.form.descriptionHint':
			'Eine kurze Beschreibung deiner Organisation und welche Veranstaltungen du ausrichtest.',

		// Actions
		'orgCreate.form.create': 'Organisation erstellen',
		'orgCreate.form.creating': 'Wird erstellt...',
		'orgCreate.form.error': 'Fehler beim Erstellen der Organisation',

		// Warnings
		'orgCreate.alreadyOwner': 'Du besitzt bereits eine Organisation',
		'orgCreate.alreadyOwnerDescription':
			'Jeder Benutzer kann nur eine Organisation besitzen. Du kannst deine bestehende Organisation über das Dashboard verwalten.',
		'orgCreate.backToDashboard': 'Zurück zum Dashboard',

		'orgCreate.emailNotVerified': 'E-Mail-Verifizierung erforderlich',
		'orgCreate.emailNotVerifiedDescription':
			'Du musst deine E-Mail-Adresse verifizieren, bevor du eine Organisation erstellen kannst. Bitte überprüfe deinen Posteingang auf die Bestätigungs-E-Mail.',
		'orgCreate.verifyEmail': 'Zu den Einstellungen',

		// Contact Email Verification Page
		'orgVerifyContactEmail.successTitle': 'E-Mail verifiziert',
		'orgVerifyContactEmail.failureTitle': 'Verifizierung fehlgeschlagen',
		'orgVerifyContactEmail.pageDescription': 'Verifizierung der Organisations-Kontakt-E-Mail',

		'orgVerifyContactEmail.verifying': 'E-Mail wird verifiziert...',
		'orgVerifyContactEmail.verifyingDescription':
			'Bitte warte, während wir deine Kontakt-E-Mail verifizieren.',

		'orgVerifyContactEmail.success': 'Kontakt-E-Mail verifiziert!',
		'orgVerifyContactEmail.successDescription':
			'Die Kontakt-E-Mail für {organizationName} wurde erfolgreich verifiziert.',

		'orgVerifyContactEmail.failure': 'Verifizierung fehlgeschlagen',
		'orgVerifyContactEmail.failureDescription':
			'Wir konnten deine Kontakt-E-Mail nicht verifizieren. Der Link ist möglicherweise abgelaufen oder ungültig.',

		'orgVerifyContactEmail.linkExpired':
			'Der Bestätigungslink ist möglicherweise abgelaufen oder ungültig.',
		'orgVerifyContactEmail.goToSettings': 'Zu den Organisationseinstellungen',
		'orgVerifyContactEmail.goToDashboard': 'Zum Dashboard',
		'orgVerifyContactEmail.backToLogin': 'Zurück zur Anmeldung'
	},

	it: {
		// User Menu
		'userMenu.createOrganization': 'Crea Organizzazione',

		// Dashboard
		'dashboard.createOrganizationButton': 'Crea Organizzazione',

		// Home Page - Start Organizing
		'learnMore.startOrganizingTitle': 'Inizia a Organizzare Eventi',
		'learnMore.startOrganizingDescription':
			'Crea la tua organizzazione e inizia a ospitare eventi straordinari per la tua comunità.',
		'learnMore.startOrganizing': 'Inizia a Organizzare',
		'learnMore.startOrganizingNote':
			'Gratuito per iniziare. Non è richiesta alcuna carta di credito.',

		// Organization Create Page
		'orgCreate.pageTitle': 'Crea Organizzazione',
		'orgCreate.pageDescription':
			'Crea la tua organizzazione per iniziare a ospitare eventi',
		'orgCreate.title': 'Crea la Tua Organizzazione',
		'orgCreate.subtitle':
			'Inizia il tuo percorso come organizzatore di eventi creando la tua organizzazione.',

		// Form Fields
		'orgCreate.form.name': 'Nome Organizzazione',
		'orgCreate.form.namePlaceholder': 'Inserisci il nome della tua organizzazione',
		'orgCreate.form.nameHint':
			'Questo nome sarà visibile a tutti gli utenti che cercano eventi.',

		'orgCreate.form.contactEmail': 'Email di Contatto',
		'orgCreate.form.contactEmailPlaceholder': 'contatto@esempio.it',
		'orgCreate.form.contactEmailVerificationNeeded':
			'Questa email dovrà essere verificata. Ti invieremo un link di verifica.',
		'orgCreate.form.contactEmailAutoVerified':
			'Stai usando la tua email verificata - non è necessaria alcuna verifica aggiuntiva.',

		'orgCreate.form.description': 'Descrizione (Opzionale)',
		'orgCreate.form.descriptionPlaceholder': 'Racconta alle persone della tua organizzazione...',
		'orgCreate.form.descriptionHint':
			'Una breve descrizione della tua organizzazione e degli eventi che ospiti.',

		// Actions
		'orgCreate.form.create': 'Crea Organizzazione',
		'orgCreate.form.creating': 'Creazione in corso...',
		'orgCreate.form.error': 'Errore nella creazione dell\'organizzazione',

		// Warnings
		'orgCreate.alreadyOwner': 'Possiedi già un\'organizzazione',
		'orgCreate.alreadyOwnerDescription':
			'Ogni utente può possedere solo un\'organizzazione. Puoi gestire la tua organizzazione esistente dalla dashboard.',
		'orgCreate.backToDashboard': 'Torna alla Dashboard',

		'orgCreate.emailNotVerified': 'Verifica email richiesta',
		'orgCreate.emailNotVerifiedDescription':
			'Devi verificare il tuo indirizzo email prima di creare un\'organizzazione. Controlla la tua casella di posta per l\'email di verifica.',
		'orgCreate.verifyEmail': 'Vai alle Impostazioni',

		// Contact Email Verification Page
		'orgVerifyContactEmail.successTitle': 'Email Verificata',
		'orgVerifyContactEmail.failureTitle': 'Verifica Fallita',
		'orgVerifyContactEmail.pageDescription':
			'Verifica dell\'email di contatto dell\'organizzazione',

		'orgVerifyContactEmail.verifying': 'Verifica email in corso...',
		'orgVerifyContactEmail.verifyingDescription':
			'Attendi mentre verifichiamo la tua email di contatto.',

		'orgVerifyContactEmail.success': 'Email di Contatto Verificata!',
		'orgVerifyContactEmail.successDescription':
			'L\'email di contatto per {organizationName} è stata verificata con successo.',

		'orgVerifyContactEmail.failure': 'Verifica Fallita',
		'orgVerifyContactEmail.failureDescription':
			'Non siamo riusciti a verificare la tua email di contatto. Il link potrebbe essere scaduto o non valido.',

		'orgVerifyContactEmail.linkExpired':
			'Il link di verifica potrebbe essere scaduto o non valido.',
		'orgVerifyContactEmail.goToSettings': 'Vai alle Impostazioni dell\'Organizzazione',
		'orgVerifyContactEmail.goToDashboard': 'Vai alla Dashboard',
		'orgVerifyContactEmail.backToLogin': 'Torna al Login'
	}
};

// Function to deeply merge translations
function mergeTranslations(target, source) {
	for (const key in source) {
		if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
			if (!target[key]) {
				target[key] = {};
			}
			mergeTranslations(target[key], source[key]);
		} else {
			target[key] = source[key];
		}
	}
}

// Process each language
['en', 'de', 'it'].forEach((lang) => {
	const filePath = path.join(__dirname, '..', 'messages', `${lang}.json`);

	try {
		// Read existing translations
		const existingContent = fs.readFileSync(filePath, 'utf-8');
		const existingTranslations = JSON.parse(existingContent);

		// Merge new translations
		mergeTranslations(existingTranslations, translations[lang]);

		// Write back to file
		fs.writeFileSync(filePath, JSON.stringify(existingTranslations, null, '\t') + '\n', 'utf-8');

		console.log(`✅ Updated ${lang}.json`);
	} catch (error) {
		console.error(`❌ Error updating ${lang}.json:`, error.message);
		process.exit(1);
	}
});

console.log('\n✅ All translation files updated successfully!');
