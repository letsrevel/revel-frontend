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

export const kinkEventTicketingES: LandingPageContent = {
	slug: 'kink-event-ticketing',
	locale: 'es',
	meta: {
		title: 'Venta de entradas para eventos kink y BDSM – Privado y seguro | Revel',
		description:
			'Gestión de eventos para comunidades kink, BDSM y sex-positive. Selección de participantes, controles de privacidad, discreción. Código abierto, autoalojable.',
		keywords:
			'entradas eventos bdsm, software gestión eventos kink, eventos sex positive españa, entradas fiestas fetichistas, plataforma eventos para adultos'
	},
	hero: {
		headline: 'Gestión discreta de eventos para comunidades kink',
		subheadline:
			'Selección de participantes, controles de privacidad y control total de tus datos. Creado para eventos que requieren discreción.'
	},
	intro: {
		paragraphs: [
			'Organizar eventos kink y BDSM implica equilibrar privacidad, consentimiento y confianza, a la vez que se gestionan entradas, confirmaciones de asistencia y participantes. La mayoría de las plataformas no están pensadas para esto. Revel sí.',
			'Creado por personas organizadoras de comunidades que entienden las necesidades particulares de los espacios sex-positive, Revel es un software de eventos de código abierto diseñado para la discreción. Filtra a quienes participan con cuestionarios personalizados. Controla exactamente quién ve tus eventos. Mantén los datos de los participantes completamente privados.',
			'Ya organices play parties, munches, talleres o grandes eventos fetichistas, Revel te da las herramientas para mantener la confianza y la seguridad que tu comunidad espera, sin renunciar a funciones ni preocuparte por la censura de la plataforma.'
		]
	},
	features: [
		{
			icon: 'clipboard',
			title: 'Selección de participantes',
			description:
				'Exige cuestionarios antes de la compra de la entrada. Revisa las solicitudes manualmente, aprueba automáticamente según criterios, o combina ambos flujos.'
		},
		{
			icon: 'eye',
			title: 'Controles de visibilidad',
			description:
				'Listados públicos, solo para miembros, o eventos completamente privados solo por invitación. Tú decides quién sabe de tus eventos.'
		},
		{
			icon: 'lock',
			title: 'Discreción total',
			description:
				'Ninguna plataforma puede filtrar tu lista de participantes. Autoalójate para máxima privacidad, o usa nuestros servidores europeos seguros.'
		},
		{
			icon: 'shield',
			title: 'Sin riesgo de deplatforming',
			description:
				'Código abierto y autoalojable. Sin políticas de contenido corporativas. Tus eventos, tus reglas.'
		},
		{
			icon: 'users',
			title: 'Membresía de comunidad',
			description:
				'Construye listas de miembros de confianza con el tiempo. Restringe eventos a miembros verificados de la comunidad.'
		},
		{
			icon: 'ticket',
			title: 'Funciones completas de eventos',
			description:
				'Múltiples niveles de entrada, check-in con QR, pases de Apple Wallet, compras por lotes: todo lo necesario para organizar eventos profesionales.'
		}
	],
	benefits: {
		title: 'Por qué quienes organizan eventos kink eligen Revel',
		items: [
			'Filtra a quienes participan para mantener los estándares de la comunidad y la cultura del consentimiento',
			'Mantén privadas las identidades de los participantes y los detalles del evento',
			'Sin riesgo de que tus eventos se eliminen por políticas de contenido de la plataforma',
			'Construye y mantén comunidades de miembros de confianza',
			'Autoalójate para tener control total sobre datos sensibles',
			'Creado por personas que entienden la organización de eventos kink'
		]
	},
	cta: {
		title: 'Eventos que respetan la privacidad y el consentimiento',
		description: 'Descubre cómo Revel protege a tu comunidad o despliégalo por tu cuenta.',
		buttons: [
			{ text: 'Probar la demo en vivo', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Autoalojar (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Contacto', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: '¿Cómo funciona la selección de participantes?',
			answer:
				'Creas cuestionarios con las preguntas que necesites: nivel de experiencia, referencias de la comunidad, confirmaciones de consentimiento, etc. Quienes participan deben completar el cuestionario antes de poder comprar entradas. Puedes revisar las solicitudes manualmente, establecer reglas de aprobación automática, o combinar ambos enfoques.'
		},
		{
			question: '¿Puedo mantener mis eventos completamente privados?',
			answer:
				'Sí. Los eventos se pueden configurar como solo por invitación, visibles solo para miembros, o completamente sin listar. También puedes enviar invitaciones directas que omitan los requisitos habituales para personas invitadas de confianza.'
		},
		{
			question: '¿Y si necesito privacidad máxima?',
			answer:
				'Autoaloja Revel en tu propia infraestructura. Tus datos nunca tocan nuestros servidores. El software tiene licencia MIT y es gratuito: solo pagas tu propio alojamiento y el procesamiento de pagos con Stripe.'
		},
		{
			question: '¿Hay riesgo de que censuren mis eventos?',
			answer:
				'Con Revel, no. Somos de código abierto y no tenemos políticas de contenido que restrinjan eventos para adultos. Si te autoalojas, tienes autonomía completa. Nuestra versión alojada funciona en infraestructura europea y apoyamos explícitamente a las comunidades sex-positive.'
		}
	],
	relatedPages: ['queer-event-management', 'privacy-focused-events', 'self-hosted-event-platform']
};

export const kinkEventTicketingPT: LandingPageContent = {
	slug: 'kink-event-ticketing',
	locale: 'pt',
	meta: {
		title: 'Bilhética para eventos kink e BDSM – Privado e seguro | Revel',
		description:
			'Gestão de eventos para comunidades kink, BDSM e sex-positive. Seleção de participantes, controlos de privacidade, discrição. Código aberto, autoalojável.',
		keywords:
			'bilhética eventos bdsm, gestão eventos kink, eventos sex positive, bilhetes festas fetichistas, plataforma eventos para adultos'
	},
	hero: {
		headline: 'Gestão discreta de eventos para comunidades kink',
		subheadline:
			'Seleção de participantes, controlos de privacidade e controlo total dos teus dados. Criado para eventos que exigem discrição.'
	},
	intro: {
		paragraphs: [
			'Organizar eventos kink e BDSM implica equilibrar privacidade, consentimento e confiança, ao mesmo tempo que se gere a bilhética, as confirmações de presença e os participantes. A maioria das plataformas não foi pensada para isto. A Revel foi.',
			'Criada por pessoas organizadoras de comunidades que compreendem as necessidades específicas dos espaços sex-positive, a Revel é um software de eventos de código aberto pensado para a discrição. Seleciona participantes com questionários personalizados. Controla exatamente quem vê os teus eventos. Mantém os dados dos participantes completamente privados.',
			'Quer organizes play parties, munches, workshops ou grandes eventos fetichistas, a Revel dá-te as ferramentas para manter a confiança e a segurança que a tua comunidade espera, sem abdicar de funcionalidades nem te preocupares com censura na plataforma.'
		]
	},
	features: [
		{
			icon: 'clipboard',
			title: 'Seleção de participantes',
			description:
				'Exige questionários antes da compra do bilhete. Revê as candidaturas manualmente, aprova automaticamente segundo critérios, ou combina ambos os fluxos.'
		},
		{
			icon: 'eye',
			title: 'Controlos de visibilidade',
			description:
				'Listagens públicas, apenas para membros, ou eventos totalmente privados só por convite. Tu decides quem sabe dos teus eventos.'
		},
		{
			icon: 'lock',
			title: 'Discrição total',
			description:
				'Nenhuma plataforma pode divulgar a tua lista de participantes. Autoaloja-te para privacidade máxima, ou usa os nossos servidores europeus seguros.'
		},
		{
			icon: 'shield',
			title: 'Sem risco de deplatforming',
			description:
				'Código aberto e autoalojável. Sem políticas de conteúdo corporativas. Os teus eventos, as tuas regras.'
		},
		{
			icon: 'users',
			title: 'Adesão à comunidade',
			description:
				'Constrói listas de membros de confiança ao longo do tempo. Restringe eventos a membros verificados da comunidade.'
		},
		{
			icon: 'ticket',
			title: 'Funcionalidades completas de eventos',
			description:
				'Vários níveis de bilhete, check-in por QR, passes Apple Wallet, compras em lote: tudo o que precisas para organizar eventos profissionais.'
		}
	],
	benefits: {
		title: 'Porque é que quem organiza eventos kink escolhe a Revel',
		items: [
			'Seleciona participantes para manter os padrões da comunidade e a cultura do consentimento',
			'Mantém privadas as identidades dos participantes e os detalhes do evento',
			'Sem risco de os teus eventos serem removidos por políticas de conteúdo da plataforma',
			'Constrói e mantém comunidades de membros de confiança',
			'Autoaloja-te para teres controlo total sobre dados sensíveis',
			'Criada por pessoas que compreendem a organização de eventos kink'
		]
	},
	cta: {
		title: 'Eventos que respeitam a privacidade e o consentimento',
		description: 'Descobre como a Revel protege a tua comunidade ou aloja a tua própria instância.',
		buttons: [
			{
				text: 'Experimentar a demo ao vivo',
				href: 'https://demo.letsrevel.io',
				variant: 'primary'
			},
			{ text: 'Autoalojar (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Contacto', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Como funciona a seleção de participantes?',
			answer:
				'Crias questionários com as perguntas de que precisas: nível de experiência, referências da comunidade, confirmações de consentimento, etc. Quem participa tem de preencher o questionário antes de poder comprar bilhetes. Podes rever as candidaturas manualmente, definir regras de aprovação automática, ou combinar as duas abordagens.'
		},
		{
			question: 'Posso manter os meus eventos totalmente privados?',
			answer:
				'Sim. Os eventos podem ser configurados como só por convite, visíveis apenas para membros, ou totalmente não listados. Também podes enviar convites diretos que dispensam os requisitos habituais para pessoas convidadas de confiança.'
		},
		{
			question: 'E se precisar de privacidade máxima?',
			answer:
				'Autoaloja a Revel na tua própria infraestrutura. Os teus dados nunca tocam nos nossos servidores. O software tem licença MIT e é gratuito: só pagas o teu próprio alojamento e o processamento de pagamentos com Stripe.'
		},
		{
			question: 'Há algum risco de os meus eventos serem censurados?',
			answer:
				'Com a Revel, não. Somos de código aberto e não temos políticas de conteúdo que restrinjam eventos para adultos. Se te autoalojares, tens autonomia completa. A nossa versão alojada corre em infraestrutura europeia e apoiamos explicitamente as comunidades sex-positive.'
		}
	],
	relatedPages: ['queer-event-management', 'privacy-focused-events', 'self-hosted-event-platform']
};
