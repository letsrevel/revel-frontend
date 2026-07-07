import type { LandingPageContent } from './types';

export const privacyFocusedEventsEN: LandingPageContent = {
	slug: 'privacy-focused-events',
	locale: 'en',
	meta: {
		title: 'Privacy-First Event Platform – GDPR Compliant | Revel',
		description:
			'Event management that respects privacy. No data harvesting, no third-party trackers. European hosting, full GDPR compliance. Open source.',
		keywords:
			'gdpr event platform, privacy focused events, european event software, data protection events, private event management'
	},
	hero: {
		headline: 'Event Management That Respects Privacy',
		subheadline:
			'No data harvesting. No third-party trackers. European hosting with full GDPR compliance.'
	},
	intro: {
		paragraphs: [
			"Most event platforms harvest your attendee data for advertising, share it with third parties, and bury the details in lengthy privacy policies. If you care about your community's privacy—or simply need to comply with GDPR—you need a different approach.",
			"Revel is open-source event management built with privacy as a core principle, not an afterthought. We don't track users across the web. We don't sell data. We don't even have the business model that would incentivize us to do so.",
			'Hosted on European infrastructure with full GDPR compliance, or self-host for complete control. Your attendee data stays yours, and your community can trust that their information is handled responsibly.'
		]
	},
	features: [
		{
			icon: 'shield',
			title: 'No Third-Party Trackers',
			description:
				"No Google Analytics, no Facebook pixels, no advertising SDKs. We don't track your attendees across the web."
		},
		{
			icon: 'globe',
			title: 'European Hosting',
			description:
				'Our hosted version runs on European infrastructure, ensuring your data stays under EU jurisdiction and GDPR protection.'
		},
		{
			icon: 'lock',
			title: 'Data Minimization',
			description:
				"We collect only what's needed to run events. No building profiles, no behavioral analysis, no data monetization."
		},
		{
			icon: 'server',
			title: 'Self-Host Option',
			description:
				'For maximum control, deploy Revel on your own infrastructure. Your data never touches our servers.'
		},
		{
			icon: 'code',
			title: 'Transparent Codebase',
			description:
				'Open source means you can audit exactly how your data is handled. No hidden tracking, no surprises.'
		},
		{
			icon: 'check',
			title: 'GDPR by Design',
			description:
				'Data export, deletion requests, consent management—privacy compliance is built into the platform.'
		}
	],
	benefits: {
		title: 'Privacy as a Feature, Not a Checkbox',
		items: [
			'Full GDPR compliance for European organizers and attendees',
			'No data selling or sharing with advertisers',
			'Transparent, auditable open-source codebase',
			'European hosting with data sovereignty',
			'Self-host option for complete control',
			'Clear, honest privacy practices you can explain to your community'
		]
	},
	cta: {
		title: 'Events Without Surveillance',
		description: 'See how Revel handles data or deploy it yourself for complete control.',
		buttons: [
			{ text: 'Try the Live Demo', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Self-Host (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Contact Us', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'How is Revel GDPR compliant?',
			answer:
				'We practice data minimization, provide data export and deletion tools, obtain proper consent, and host on European infrastructure. As open source, you can audit our data practices directly in the code.'
		},
		{
			question: 'Do you sell attendee data?',
			answer:
				'No. We have no advertising business model. Our revenue comes from a small per-ticket fee on paid events (for hosted customers). We have no incentive to monetize your data.'
		},
		{
			question: 'What data do you collect?',
			answer:
				"Only what's necessary: account information, event details, ticket purchases, and attendee lists. We don't track browsing behavior, build advertising profiles, or collect data beyond what you explicitly provide."
		},
		{
			question: 'Can I get complete data control?',
			answer:
				'Yes. Self-host Revel on your own infrastructure and your data never touches our servers. The platform is MIT licensed and free to deploy.'
		}
	],
	relatedPages: ['self-hosted-event-platform', 'queer-event-management']
};

export const privacyFocusedEventsDE: LandingPageContent = {
	slug: 'privacy-focused-events',
	locale: 'de',
	meta: {
		title: 'Datenschutzorientierte Event-Plattform – DSGVO-Konform | Revel',
		description:
			'Event-Management, das Privatsphäre respektiert. Keine Datensammlung, keine Drittanbieter-Tracker. Europäisches Hosting, volle DSGVO-Konformität. Open Source.',
		keywords:
			'dsgvo event plattform, datenschutz events, europäische event software, datenschutz veranstaltungen, private event verwaltung'
	},
	hero: {
		headline: 'Event-Management, Das Privatsphäre Respektiert',
		subheadline:
			'Keine Datensammlung. Keine Drittanbieter-Tracker. Europäisches Hosting mit voller DSGVO-Konformität.'
	},
	intro: {
		paragraphs: [
			'Die meisten Event-Plattformen sammeln deine Teilnehmerdaten für Werbung, teilen sie mit Dritten und verstecken die Details in langen Datenschutzerklärungen. Wenn dir die Privatsphäre deiner Community wichtig ist – oder du einfach die DSGVO einhalten musst – brauchst du einen anderen Ansatz.',
			'Revel ist Open-Source Event-Management, das mit Datenschutz als Kernprinzip entwickelt wurde, nicht als Nachgedanke. Wir tracken keine Nutzer durchs Web. Wir verkaufen keine Daten. Wir haben nicht mal ein Geschäftsmodell, das uns dazu anreizen würde.',
			'Gehostet auf europäischer Infrastruktur mit voller DSGVO-Konformität, oder selbst hosten für komplette Kontrolle. Deine Teilnehmerdaten bleiben deine, und deine Community kann darauf vertrauen, dass ihre Informationen verantwortungsvoll behandelt werden.'
		]
	},
	features: [
		{
			icon: 'shield',
			title: 'Keine Drittanbieter-Tracker',
			description:
				'Kein Google Analytics, keine Facebook-Pixel, keine Werbe-SDKs. Wir tracken deine Teilnehmer nicht durchs Web.'
		},
		{
			icon: 'globe',
			title: 'Europäisches Hosting',
			description:
				'Unsere gehostete Version läuft auf europäischer Infrastruktur und stellt sicher, dass deine Daten unter EU-Rechtsprechung und DSGVO-Schutz bleiben.'
		},
		{
			icon: 'lock',
			title: 'Datenminimierung',
			description:
				'Wir sammeln nur was für Events nötig ist. Kein Profil-Building, keine Verhaltensanalyse, keine Datenmonetarisierung.'
		},
		{
			icon: 'server',
			title: 'Selbst-Hosting Option',
			description:
				'Für maximale Kontrolle Revel auf eigener Infrastruktur betreiben. Deine Daten berühren niemals unsere Server.'
		},
		{
			icon: 'code',
			title: 'Transparenter Code',
			description:
				'Open Source bedeutet, du kannst genau prüfen, wie deine Daten behandelt werden. Kein verstecktes Tracking, keine Überraschungen.'
		},
		{
			icon: 'check',
			title: 'DSGVO by Design',
			description:
				'Datenexport, Löschanfragen, Einwilligungsverwaltung – Datenschutz-Compliance ist in die Plattform eingebaut.'
		}
	],
	benefits: {
		title: 'Datenschutz als Feature, Nicht als Checkbox',
		items: [
			'Volle DSGVO-Konformität für europäische Veranstalter und Teilnehmer',
			'Kein Datenverkauf oder Teilen mit Werbetreibenden',
			'Transparenter, prüfbarer Open-Source-Code',
			'Europäisches Hosting mit Datensouveränität',
			'Selbst-Hosting Option für komplette Kontrolle',
			'Klare, ehrliche Datenschutzpraktiken, die du deiner Community erklären kannst'
		]
	},
	cta: {
		title: 'Events Ohne Überwachung',
		description: 'Sieh wie Revel mit Daten umgeht oder betreibe es selbst für komplette Kontrolle.',
		buttons: [
			{ text: 'Live-Demo Testen', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{
				text: 'Selbst Hosten (GitHub)',
				href: 'https://github.com/letsrevel',
				variant: 'secondary'
			},
			{ text: 'Kontakt', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Wie ist Revel DSGVO-konform?',
			answer:
				'Wir praktizieren Datenminimierung, bieten Datenexport- und Löschtools, holen ordnungsgemäße Einwilligung ein und hosten auf europäischer Infrastruktur. Als Open Source kannst du unsere Datenpraktiken direkt im Code prüfen.'
		},
		{
			question: 'Verkauft ihr Teilnehmerdaten?',
			answer:
				'Nein. Wir haben kein Werbe-Geschäftsmodell. Unsere Einnahmen kommen von einer kleinen Pro-Ticket-Gebühr bei bezahlten Events (für gehostete Kunden). Wir haben keinen Anreiz, deine Daten zu monetarisieren.'
		},
		{
			question: 'Welche Daten sammelt ihr?',
			answer:
				'Nur das Notwendige: Account-Informationen, Event-Details, Ticket-Käufe und Teilnehmerlisten. Wir tracken kein Browsing-Verhalten, erstellen keine Werbeprofile oder sammeln Daten über das hinaus, was du explizit angibst.'
		},
		{
			question: 'Kann ich komplette Datenkontrolle bekommen?',
			answer:
				'Ja. Hoste Revel selbst auf eigener Infrastruktur und deine Daten berühren niemals unsere Server. Die Plattform ist MIT-lizenziert und kostenlos zu betreiben.'
		}
	],
	relatedPages: ['self-hosted-event-platform', 'queer-event-management']
};

export const privacyFocusedEventsIT: LandingPageContent = {
	slug: 'privacy-focused-events',
	locale: 'it',
	meta: {
		title: 'Piattaforma Eventi Privacy-First – Conforme GDPR | Revel',
		description:
			'Gestione eventi che rispetta la privacy. Nessuna raccolta dati, nessun tracker terze parti. Hosting europeo, piena conformità GDPR. Open source.',
		keywords:
			'piattaforma eventi gdpr, eventi privacy, software eventi europeo, protezione dati eventi, gestione eventi privati'
	},
	hero: {
		headline: 'Gestione Eventi Che Rispetta la Privacy',
		subheadline:
			'Nessuna raccolta dati. Nessun tracker terze parti. Hosting europeo con piena conformità GDPR.'
	},
	intro: {
		paragraphs: [
			'La maggior parte delle piattaforme eventi raccoglie i dati dei partecipanti per la pubblicità, li condivide con terze parti e nasconde i dettagli in lunghe policy sulla privacy. Se ti importa della privacy della tua community—o semplicemente devi conformarti al GDPR—hai bisogno di un approccio diverso.',
			'Revel è gestione eventi open-source costruita con la privacy come principio fondamentale, non come ripensamento. Non tracciamo gli utenti sul web. Non vendiamo dati. Non abbiamo nemmeno un modello di business che ci incentiverebbe a farlo.',
			'Hostato su infrastruttura europea con piena conformità GDPR, o fai self-host per controllo completo. I dati dei tuoi partecipanti restano tuoi, e la tua community può fidarsi che le loro informazioni sono gestite responsabilmente.'
		]
	},
	features: [
		{
			icon: 'shield',
			title: 'Nessun Tracker Terze Parti',
			description:
				'Niente Google Analytics, niente pixel Facebook, niente SDK pubblicitari. Non tracciamo i tuoi partecipanti sul web.'
		},
		{
			icon: 'globe',
			title: 'Hosting Europeo',
			description:
				'La nostra versione hosted gira su infrastruttura europea, assicurando che i tuoi dati restino sotto giurisdizione UE e protezione GDPR.'
		},
		{
			icon: 'lock',
			title: 'Minimizzazione Dati',
			description:
				'Raccogliamo solo il necessario per gestire eventi. Nessun profiling, nessuna analisi comportamentale, nessuna monetizzazione dati.'
		},
		{
			icon: 'server',
			title: 'Opzione Self-Host',
			description:
				'Per massimo controllo, installa Revel sulla tua infrastruttura. I tuoi dati non toccano mai i nostri server.'
		},
		{
			icon: 'code',
			title: 'Codice Trasparente',
			description:
				'Open source significa che puoi verificare esattamente come vengono gestiti i tuoi dati. Nessun tracking nascosto, nessuna sorpresa.'
		},
		{
			icon: 'check',
			title: 'GDPR by Design',
			description:
				'Export dati, richieste cancellazione, gestione consenso—la conformità privacy è integrata nella piattaforma.'
		}
	],
	benefits: {
		title: 'Privacy Come Funzionalità, Non Come Checkbox',
		items: [
			'Piena conformità GDPR per organizzatori e partecipanti europei',
			'Nessuna vendita o condivisione dati con inserzionisti',
			'Codice open-source trasparente e verificabile',
			'Hosting europeo con sovranità dei dati',
			'Opzione self-host per controllo completo',
			'Pratiche privacy chiare e oneste che puoi spiegare alla tua community'
		]
	},
	cta: {
		title: 'Eventi Senza Sorveglianza',
		description: 'Scopri come Revel gestisce i dati o installalo tu stesso per controllo completo.',
		buttons: [
			{ text: 'Prova la Demo', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Self-Host (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Contattaci', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Come è Revel conforme al GDPR?',
			answer:
				'Pratichiamo minimizzazione dati, forniamo strumenti di export e cancellazione dati, otteniamo consenso appropriato e hostiamo su infrastruttura europea. Come open source, puoi verificare le nostre pratiche dati direttamente nel codice.'
		},
		{
			question: 'Vendete i dati dei partecipanti?',
			answer:
				'No. Non abbiamo un modello di business pubblicitario. I nostri ricavi vengono da una piccola commissione per biglietto su eventi a pagamento (per clienti hosted). Non abbiamo incentivo a monetizzare i tuoi dati.'
		},
		{
			question: 'Quali dati raccogliete?',
			answer:
				'Solo il necessario: informazioni account, dettagli eventi, acquisti biglietti e liste partecipanti. Non tracciamo comportamento di navigazione, non costruiamo profili pubblicitari, non raccogliamo dati oltre quello che fornisci esplicitamente.'
		},
		{
			question: 'Posso avere controllo completo sui dati?',
			answer:
				'Sì. Fai self-host di Revel sulla tua infrastruttura e i tuoi dati non toccano mai i nostri server. La piattaforma è licenziata MIT e gratuita da installare.'
		}
	],
	relatedPages: ['self-hosted-event-platform', 'queer-event-management']
};

export const privacyFocusedEventsFR: LandingPageContent = {
	slug: 'privacy-focused-events',
	locale: 'fr',
	meta: {
		title: 'Plateforme événementielle respectueuse de la vie privée – Conforme RGPD | Revel',
		description:
			'Une gestion événementielle qui respecte la vie privée. Aucune collecte de données, aucun traqueur tiers. Hébergement européen, pleine conformité RGPD. Open source.',
		keywords:
			'plateforme événementielle rgpd, événements respect vie privée, logiciel événementiel européen, gestion événements confidentialité, billetterie sans tracking, protection données personnelles'
	},
	hero: {
		headline: 'Une gestion événementielle qui respecte ta vie privée',
		subheadline:
			'Aucune collecte de données. Aucun traqueur tiers. Hébergement européen en pleine conformité RGPD.'
	},
	intro: {
		paragraphs: [
			'La plupart des plateformes événementielles collectent les données de tes participant·es à des fins publicitaires, les partagent avec des tiers et cachent les détails dans de longues politiques de confidentialité. Si la vie privée de ta communauté te tient à cœur – ou si tu dois simplement respecter le RGPD – il te faut une autre approche.',
			"Revel est une solution de gestion événementielle open source, conçue avec la protection de la vie privée comme principe fondamental, et non comme une réflexion après coup. Nous ne traquons pas les utilisateur·ices à travers le web. Nous ne vendons pas de données. Nous n'avons même pas de modèle économique qui nous y inciterait.",
			'Hébergée sur une infrastructure européenne en pleine conformité RGPD, ou auto-hébergée pour un contrôle total. Les données de tes participant·es restent les tiennes, et ta communauté peut avoir confiance dans le fait que ses informations sont traitées de façon responsable.'
		]
	},
	features: [
		{
			icon: 'shield',
			title: 'Aucun traqueur tiers',
			description:
				'Pas de Google Analytics, pas de pixel Facebook, pas de SDK publicitaire. Nous ne traquons pas tes participant·es à travers le web.'
		},
		{
			icon: 'globe',
			title: 'Hébergement européen',
			description:
				"Notre version hébergée tourne sur une infrastructure européenne, garantissant que tes données restent sous juridiction de l'UE et sous la protection du RGPD."
		},
		{
			icon: 'lock',
			title: 'Minimisation des données',
			description:
				'Nous ne collectons que ce qui est nécessaire aux événements. Aucun profilage, aucune analyse comportementale, aucune monétisation des données.'
		},
		{
			icon: 'server',
			title: 'Option d’auto-hébergement',
			description:
				'Pour un contrôle maximal, fais tourner Revel sur ta propre infrastructure. Tes données ne touchent jamais nos serveurs.'
		},
		{
			icon: 'code',
			title: 'Code transparent',
			description:
				"L'open source signifie que tu peux vérifier exactement comment tes données sont traitées. Aucun tracking caché, aucune surprise."
		},
		{
			icon: 'check',
			title: 'RGPD by design',
			description:
				'Export de données, demandes de suppression, gestion du consentement – la conformité à la vie privée est intégrée à la plateforme.'
		}
	],
	benefits: {
		title: 'La confidentialité comme fonctionnalité, pas comme simple case à cocher',
		items: [
			'Pleine conformité RGPD pour les organisateur·ices et participant·es européen·nes',
			'Aucune vente ni partage de données avec des annonceurs',
			'Code open source transparent et auditable',
			'Hébergement européen avec souveraineté des données',
			"Option d'auto-hébergement pour un contrôle total",
			'Des pratiques de confidentialité claires et honnêtes que tu peux expliquer à ta communauté'
		]
	},
	cta: {
		title: 'Des événements sans surveillance',
		description:
			'Découvre comment Revel traite les données, ou fais-le tourner toi-même pour un contrôle total.',
		buttons: [
			{ text: 'Tester la démo live', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{
				text: 'Auto-héberger (GitHub)',
				href: 'https://github.com/letsrevel',
				variant: 'secondary'
			},
			{ text: 'Nous contacter', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'En quoi Revel est-il conforme au RGPD ?',
			answer:
				"Nous appliquons la minimisation des données, proposons des outils d'export et de suppression, recueillons un consentement en bonne et due forme et hébergeons sur une infrastructure européenne. Comme c'est open source, tu peux vérifier nos pratiques de traitement des données directement dans le code."
		},
		{
			question: 'Vendez-vous les données des participant·es ?',
			answer:
				"Non. Nous n'avons aucun modèle économique publicitaire. Nos revenus proviennent d'une petite commission par billet sur les événements payants (pour les client·es de la version hébergée). Nous n'avons aucun intérêt à monétiser tes données."
		},
		{
			question: 'Quelles données collectez-vous ?',
			answer:
				'Uniquement le nécessaire : informations de compte, détails des événements, achats de billets et listes de participant·es. Nous ne traquons aucun comportement de navigation, ne créons aucun profil publicitaire et ne collectons rien au-delà de ce que tu fournis explicitement.'
		},
		{
			question: 'Puis-je obtenir un contrôle total sur mes données ?',
			answer:
				'Oui. Auto-héberge Revel sur ta propre infrastructure et tes données ne toucheront jamais nos serveurs. La plateforme est sous licence MIT et gratuite à exploiter.'
		}
	],
	relatedPages: ['self-hosted-event-platform', 'queer-event-management']
};
