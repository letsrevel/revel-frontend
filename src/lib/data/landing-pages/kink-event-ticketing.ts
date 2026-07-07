import type { LandingPageContent } from './types';

export const kinkEventTicketingEN: LandingPageContent = {
	slug: 'kink-event-ticketing',
	locale: 'en',
	meta: {
		title: 'Ticketing for Kink & BDSM Events – Private & Secure | Revel',
		description:
			'Event management for kink, BDSM, and sex-positive communities. Attendee screening, privacy controls, discretion. Open-source, self-hostable.',
		keywords:
			'bdsm event ticketing, kink event management, sex positive events, fetish party ticketing, adult event platform'
	},
	hero: {
		headline: 'Discreet Event Management for Kink Communities',
		subheadline:
			'Attendee screening, privacy controls, and complete data ownership. Built for events that need discretion.'
	},
	intro: {
		paragraphs: [
			"Organizing kink and BDSM events means balancing privacy, consent, and trust—while still handling the logistics of ticketing, RSVPs, and attendee management. Most platforms aren't built for this. Revel is.",
			'Created by community organizers who understand the unique needs of sex-positive spaces, Revel is open-source event software designed for discretion. Screen attendees with custom questionnaires. Control exactly who sees your events. Keep attendee data completely private.',
			"Whether you're running play parties, munches, workshops, or large fetish events, Revel gives you the tools to maintain the trust and safety your community expects—without compromising on features or worrying about platform censorship."
		]
	},
	features: [
		{
			icon: 'clipboard',
			title: 'Attendee Screening',
			description:
				'Require questionnaires before ticket purchase. Review applications manually, auto-approve based on criteria, or use hybrid workflows.'
		},
		{
			icon: 'eye',
			title: 'Visibility Controls',
			description:
				'Public listings, members-only, or completely private invite-only events. You decide who knows about your events.'
		},
		{
			icon: 'lock',
			title: 'Complete Discretion',
			description:
				'No platform that can leak your attendee list. Self-host for maximum privacy, or use our secure European servers.'
		},
		{
			icon: 'shield',
			title: 'No Deplatforming Risk',
			description:
				'Open source and self-hostable. No corporate content policies. Your events, your rules.'
		},
		{
			icon: 'users',
			title: 'Community Membership',
			description:
				'Build trusted member lists over time. Restrict events to vetted community members.'
		},
		{
			icon: 'ticket',
			title: 'Full Event Features',
			description:
				'Multiple ticket tiers, QR check-in, Apple Wallet passes, batch purchases—everything you need to run professional events.'
		}
	],
	benefits: {
		title: 'Why Kink Organizers Choose Revel',
		items: [
			'Screen attendees to maintain community standards and consent culture',
			'Keep attendee identities and event details private',
			'No risk of events being removed due to platform content policies',
			'Build and maintain trusted member communities',
			'Self-host for complete control over sensitive data',
			'Created by people who understand kink event organizing'
		]
	},
	cta: {
		title: 'Events That Respect Privacy and Consent',
		description: 'See how Revel protects your community or deploy it yourself.',
		buttons: [
			{ text: 'Try the Live Demo', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Self-Host (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Contact Us', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'How does attendee screening work?',
			answer:
				'You create questionnaires with any questions you need—experience level, community references, consent acknowledgments, etc. Attendees must complete the questionnaire before they can purchase tickets. You can review submissions manually, set auto-approval rules, or combine both approaches.'
		},
		{
			question: 'Can I keep my events completely private?',
			answer:
				'Yes. Events can be set to invite-only, visible only to members, or completely unlisted. You can also send direct invitations that bypass normal requirements for trusted guests.'
		},
		{
			question: 'What if I need maximum privacy?',
			answer:
				'Self-host Revel on your own infrastructure. Your data never touches our servers. The software is MIT licensed and free to use—you only pay for your own hosting and Stripe payment processing.'
		},
		{
			question: 'Is there any risk of my events being censored?',
			answer:
				"Not with Revel. We're open source with no content policies restricting adult events. If you self-host, you have complete autonomy. Our hosted version is run on European infrastructure and we explicitly support sex-positive communities."
		}
	],
	relatedPages: ['queer-event-management', 'privacy-focused-events', 'self-hosted-event-platform']
};

export const kinkEventTicketingDE: LandingPageContent = {
	slug: 'kink-event-ticketing',
	locale: 'de',
	meta: {
		title: 'Ticketing für Kink & BDSM Events – Privat & Sicher | Revel',
		description:
			'Event-Management für Kink-, BDSM- und sex-positive Communities. Teilnehmer-Screening, Datenschutzkontrollen, Diskretion. Open-Source, selbst hostbar.',
		keywords:
			'bdsm event ticketing, kink veranstaltung, sex positive events, fetisch party ticketing, adult event plattform'
	},
	hero: {
		headline: 'Diskretes Event-Management für Kink-Communities',
		subheadline:
			'Teilnehmer-Screening, Datenschutzkontrollen und vollständige Datenhoheit. Entwickelt für Events, die Diskretion erfordern.'
	},
	intro: {
		paragraphs: [
			'Die Organisation von Kink- und BDSM-Events bedeutet, Privatsphäre, Konsens und Vertrauen in Einklang zu bringen – während man gleichzeitig Ticketing, RSVPs und Teilnehmerverwaltung handhabt. Die meisten Plattformen sind dafür nicht gebaut. Revel schon.',
			'Entwickelt von Community-Organisatoren, die die einzigartigen Bedürfnisse sex-positiver Räume verstehen, ist Revel Open-Source Event-Software, die auf Diskretion ausgelegt ist. Screene Teilnehmer mit individuellen Fragebögen. Kontrolliere genau, wer deine Events sieht. Halte Teilnehmerdaten vollständig privat.',
			'Ob du Play-Partys, Munches, Workshops oder große Fetisch-Events veranstaltest – Revel gibt dir die Werkzeuge, um das Vertrauen und die Sicherheit zu wahren, die deine Community erwartet – ohne Kompromisse bei den Funktionen oder Sorgen über Plattform-Zensur.'
		]
	},
	features: [
		{
			icon: 'clipboard',
			title: 'Teilnehmer-Screening',
			description:
				'Fragebögen vor dem Ticketkauf erforderlich. Bewerbungen manuell prüfen, basierend auf Kriterien automatisch genehmigen oder Hybrid-Workflows nutzen.'
		},
		{
			icon: 'eye',
			title: 'Sichtbarkeitskontrollen',
			description:
				'Öffentliche Listings, nur für Mitglieder oder komplett private Events nur auf Einladung. Du entscheidest, wer von deinen Events erfährt.'
		},
		{
			icon: 'lock',
			title: 'Vollständige Diskretion',
			description:
				'Keine Plattform, die deine Teilnehmerliste leaken kann. Selbst hosten für maximale Privatsphäre oder unsere sicheren europäischen Server nutzen.'
		},
		{
			icon: 'shield',
			title: 'Kein Deplatforming-Risiko',
			description:
				'Open Source und selbst hostbar. Keine Unternehmens-Inhaltsrichtlinien. Deine Events, deine Regeln.'
		},
		{
			icon: 'users',
			title: 'Community-Mitgliedschaft',
			description:
				'Vertrauenswürdige Mitgliederlisten über Zeit aufbauen. Events auf geprüfte Community-Mitglieder beschränken.'
		},
		{
			icon: 'ticket',
			title: 'Vollständige Event-Funktionen',
			description:
				'Mehrere Ticket-Stufen, QR-Check-in, Apple Wallet Passes, Sammelkäufe – alles was du für professionelle Events brauchst.'
		}
	],
	benefits: {
		title: 'Warum Kink-Organisatoren Revel Wählen',
		items: [
			'Teilnehmer screenen für Community-Standards und Konsenskultur',
			'Teilnehmeridentitäten und Event-Details privat halten',
			'Kein Risiko, dass Events wegen Plattform-Inhaltsrichtlinien entfernt werden',
			'Vertrauenswürdige Mitglieder-Communities aufbauen und pflegen',
			'Selbst hosten für komplette Kontrolle über sensible Daten',
			'Entwickelt von Menschen, die Kink-Event-Organisation verstehen'
		]
	},
	cta: {
		title: 'Events, Die Privatsphäre und Konsens Respektieren',
		description: 'Sieh wie Revel deine Community schützt oder betreibe es selbst.',
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
			question: 'Wie funktioniert das Teilnehmer-Screening?',
			answer:
				'Du erstellst Fragebögen mit allen benötigten Fragen – Erfahrungslevel, Community-Referenzen, Konsens-Bestätigungen usw. Teilnehmer müssen den Fragebogen ausfüllen, bevor sie Tickets kaufen können. Du kannst Einreichungen manuell prüfen, Auto-Genehmigungs-Regeln setzen oder beide Ansätze kombinieren.'
		},
		{
			question: 'Kann ich meine Events komplett privat halten?',
			answer:
				'Ja. Events können auf nur-auf-Einladung, nur für Mitglieder sichtbar oder komplett nicht gelistet eingestellt werden. Du kannst auch direkte Einladungen senden, die normale Anforderungen für vertrauenswürdige Gäste umgehen.'
		},
		{
			question: 'Was wenn ich maximale Privatsphäre brauche?',
			answer:
				'Hoste Revel selbst auf deiner eigenen Infrastruktur. Deine Daten berühren niemals unsere Server. Die Software ist MIT-lizenziert und kostenlos nutzbar – du zahlst nur für dein eigenes Hosting und Stripe-Zahlungsabwicklung.'
		},
		{
			question: 'Besteht ein Risiko, dass meine Events zensiert werden?',
			answer:
				'Nicht mit Revel. Wir sind Open Source ohne Inhaltsrichtlinien, die Adult-Events einschränken. Beim Selbst-Hosten hast du komplette Autonomie. Unsere gehostete Version läuft auf europäischer Infrastruktur und wir unterstützen explizit sex-positive Communities.'
		}
	],
	relatedPages: ['queer-event-management', 'privacy-focused-events', 'self-hosted-event-platform']
};

export const kinkEventTicketingIT: LandingPageContent = {
	slug: 'kink-event-ticketing',
	locale: 'it',
	meta: {
		title: 'Ticketing per Eventi Kink & BDSM – Privato & Sicuro | Revel',
		description:
			'Gestione eventi per community kink, BDSM e sex-positive. Screening partecipanti, controlli privacy, discrezione. Open-source, self-hostable.',
		keywords:
			'ticketing eventi bdsm, gestione eventi kink, eventi sex positive, ticketing feste fetish, piattaforma eventi adult'
	},
	hero: {
		headline: 'Gestione Eventi Discreta per Community Kink',
		subheadline:
			'Screening partecipanti, controlli privacy e proprietà completa dei dati. Costruito per eventi che richiedono discrezione.'
	},
	intro: {
		paragraphs: [
			'Organizzare eventi kink e BDSM significa bilanciare privacy, consenso e fiducia—mentre si gestisce la logistica di ticketing, RSVP e gestione partecipanti. La maggior parte delle piattaforme non è costruita per questo. Revel sì.',
			'Creato da organizzatori di community che comprendono le esigenze uniche degli spazi sex-positive, Revel è software open-source per eventi progettato per la discrezione. Fai screening dei partecipanti con questionari personalizzati. Controlla esattamente chi vede i tuoi eventi. Mantieni i dati dei partecipanti completamente privati.',
			'Che tu stia organizzando play party, munch, workshop o grandi eventi fetish, Revel ti dà gli strumenti per mantenere la fiducia e la sicurezza che la tua community si aspetta—senza compromessi sulle funzionalità o preoccupazioni sulla censura della piattaforma.'
		]
	},
	features: [
		{
			icon: 'clipboard',
			title: 'Screening Partecipanti',
			description:
				"Richiedi questionari prima dell'acquisto biglietti. Revisiona le candidature manualmente, approva automaticamente in base a criteri o usa workflow ibridi."
		},
		{
			icon: 'eye',
			title: 'Controlli Visibilità',
			description:
				'Listing pubblici, solo membri o eventi privati solo su invito. Tu decidi chi sa dei tuoi eventi.'
		},
		{
			icon: 'lock',
			title: 'Discrezione Completa',
			description:
				'Nessuna piattaforma che possa far trapelare la tua lista partecipanti. Self-host per massima privacy o usa i nostri server europei sicuri.'
		},
		{
			icon: 'shield',
			title: 'Nessun Rischio Deplatforming',
			description:
				'Open source e self-hostable. Nessuna policy aziendale sui contenuti. I tuoi eventi, le tue regole.'
		},
		{
			icon: 'users',
			title: 'Membership Community',
			description:
				'Costruisci liste membri fidati nel tempo. Limita gli eventi ai membri verificati della community.'
		},
		{
			icon: 'ticket',
			title: 'Funzionalità Eventi Complete',
			description:
				'Più livelli biglietti, check-in QR, pass Apple Wallet, acquisti multipli—tutto il necessario per eventi professionali.'
		}
	],
	benefits: {
		title: 'Perché gli Organizzatori Kink Scelgono Revel',
		items: [
			'Screening partecipanti per mantenere gli standard della community e la cultura del consenso',
			'Mantieni private le identità dei partecipanti e i dettagli degli eventi',
			'Nessun rischio che gli eventi vengano rimossi per policy sui contenuti',
			'Costruisci e mantieni community di membri fidati',
			'Self-host per controllo completo sui dati sensibili',
			"Creato da persone che capiscono l'organizzazione eventi kink"
		]
	},
	cta: {
		title: 'Eventi Che Rispettano Privacy e Consenso',
		description: 'Scopri come Revel protegge la tua community o installalo tu stesso.',
		buttons: [
			{ text: 'Prova la Demo', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Self-Host (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Contattaci', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Come funziona lo screening partecipanti?',
			answer:
				'Crei questionari con tutte le domande necessarie—livello esperienza, referenze community, conferme consenso, ecc. I partecipanti devono completare il questionario prima di poter acquistare biglietti. Puoi revisionare le risposte manualmente, impostare regole auto-approvazione o combinare entrambi gli approcci.'
		},
		{
			question: 'Posso mantenere i miei eventi completamente privati?',
			answer:
				'Sì. Gli eventi possono essere impostati come solo su invito, visibili solo ai membri, o completamente non listati. Puoi anche inviare inviti diretti che bypassano i requisiti normali per ospiti fidati.'
		},
		{
			question: 'E se ho bisogno di massima privacy?',
			answer:
				"Fai self-host di Revel sulla tua infrastruttura. I tuoi dati non toccano mai i nostri server. Il software è licenziato MIT e gratuito da usare—paghi solo il tuo hosting e l'elaborazione pagamenti Stripe."
		},
		{
			question: "C'è rischio che i miei eventi vengano censurati?",
			answer:
				'Non con Revel. Siamo open source senza policy sui contenuti che limitano eventi adult. Se fai self-host, hai completa autonomia. La nostra versione hosted gira su infrastruttura europea e supportiamo esplicitamente le community sex-positive.'
		}
	],
	relatedPages: ['queer-event-management', 'privacy-focused-events', 'self-hosted-event-platform']
};

export const kinkEventTicketingFR: LandingPageContent = {
	slug: 'kink-event-ticketing',
	locale: 'fr',
	meta: {
		title: 'Billetterie pour événements Kink & BDSM – Privé & Sécurisé | Revel',
		description:
			"Gestion d'événements pour les communautés kink, BDSM et sex-positives. Sélection des participant·es, contrôles de confidentialité, discrétion. Open source, auto-hébergeable.",
		keywords:
			'billetterie événement bdsm, événement kink, événements sex positifs, billetterie soirée fétichiste, plateforme événement adulte'
	},
	hero: {
		headline: 'Une gestion d’événements discrète pour les communautés kink',
		subheadline:
			'Sélection des participant·es, contrôles de confidentialité et maîtrise totale de tes données. Conçu pour les événements qui exigent de la discrétion.'
	},
	intro: {
		paragraphs: [
			"Organiser des événements kink et BDSM, c'est concilier vie privée, consentement et confiance – tout en gérant la billetterie, les RSVP et l'administration des participant·es. La plupart des plateformes ne sont pas faites pour ça. Revel, si.",
			"Développé par des organisateur·rices communautaires qui comprennent les besoins spécifiques des espaces sex-positifs, Revel est un logiciel d'événementiel open source pensé pour la discrétion. Sélectionne les participant·es avec des questionnaires personnalisés. Contrôle précisément qui voit tes événements. Garde les données des participant·es entièrement privées.",
			'Que tu organises des play parties, des munches, des ateliers ou de grands événements fétichistes, Revel te donne les outils pour préserver la confiance et la sécurité que ta communauté attend – sans compromis sur les fonctionnalités ni crainte de censure de la plateforme.'
		]
	},
	features: [
		{
			icon: 'clipboard',
			title: 'Sélection des participant·es',
			description:
				"Questionnaires obligatoires avant l'achat de billet. Examine les candidatures manuellement, approuve automatiquement selon des critères ou combine les deux dans des workflows hybrides."
		},
		{
			icon: 'eye',
			title: 'Contrôles de visibilité',
			description:
				'Annonces publiques, réservées aux membres ou événements entièrement privés sur invitation uniquement. C’est toi qui décides qui a connaissance de tes événements.'
		},
		{
			icon: 'lock',
			title: 'Discrétion totale',
			description:
				'Aucune plateforme susceptible de divulguer ta liste de participant·es. Auto-héberge pour une confidentialité maximale ou utilise nos serveurs européens sécurisés.'
		},
		{
			icon: 'shield',
			title: 'Aucun risque de déplateformisation',
			description:
				'Open source et auto-hébergeable. Aucune politique de contenu imposée par une entreprise. Tes événements, tes règles.'
		},
		{
			icon: 'users',
			title: 'Adhésion communautaire',
			description:
				'Constitue au fil du temps des listes de membres de confiance. Réserve tes événements aux membres vérifié·es de la communauté.'
		},
		{
			icon: 'ticket',
			title: "Toutes les fonctionnalités d'événement",
			description:
				"Plusieurs niveaux de billets, check-in par QR code, passes Apple Wallet, achats groupés – tout ce qu'il te faut pour des événements professionnels."
		}
	],
	benefits: {
		title: 'Pourquoi les organisateur·rices kink choisissent Revel',
		items: [
			'Sélectionner les participant·es selon les standards de la communauté et la culture du consentement',
			'Garder privées les identités des participant·es et les détails des événements',
			'Aucun risque de voir tes événements supprimés à cause des politiques de contenu d’une plateforme',
			'Construire et entretenir des communautés de membres de confiance',
			'Auto-héberger pour une maîtrise totale des données sensibles',
			'Conçu par des personnes qui comprennent l’organisation d’événements kink'
		]
	},
	cta: {
		title: 'Des événements qui respectent la vie privée et le consentement',
		description: 'Découvre comment Revel protège ta communauté, ou héberge-le toi-même.',
		buttons: [
			{ text: 'Tester la démo en ligne', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{
				text: 'Auto-héberger (GitHub)',
				href: 'https://github.com/letsrevel',
				variant: 'secondary'
			},
			{ text: 'Contact', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Comment fonctionne la sélection des participant·es ?',
			answer:
				"Tu crées des questionnaires avec toutes les questions dont tu as besoin – niveau d'expérience, références communautaires, confirmations de consentement, etc. Les participant·es doivent remplir le questionnaire avant de pouvoir acheter un billet. Tu peux examiner les soumissions manuellement, définir des règles d'approbation automatique ou combiner les deux approches."
		},
		{
			question: 'Puis-je garder mes événements entièrement privés ?',
			answer:
				'Oui. Les événements peuvent être configurés sur invitation uniquement, visibles seulement par les membres ou totalement non répertoriés. Tu peux aussi envoyer des invitations directes qui contournent les exigences habituelles pour les invité·es de confiance.'
		},
		{
			question: "Et si j'ai besoin d'une confidentialité maximale ?",
			answer:
				'Héberge Revel toi-même sur ta propre infrastructure. Tes données ne touchent jamais nos serveurs. Le logiciel est sous licence MIT et libre d’utilisation – tu ne paies que ton propre hébergement et le traitement des paiements Stripe.'
		},
		{
			question: 'Y a-t-il un risque que mes événements soient censurés ?',
			answer:
				'Pas avec Revel. Nous sommes open source, sans politique de contenu restreignant les événements pour adultes. En auto-hébergement, tu disposes d’une autonomie complète. Notre version hébergée tourne sur une infrastructure européenne et nous soutenons explicitement les communautés sex-positives.'
		}
	],
	relatedPages: ['queer-event-management', 'privacy-focused-events', 'self-hosted-event-platform']
};
