import type { LandingPageContent } from './types';

export const selfHostedEventPlatformEN: LandingPageContent = {
	slug: 'self-hosted-event-platform',
	locale: 'en',
	meta: {
		title: 'Self-Hosted Event Management – Open Source & Free | Revel',
		description:
			'MIT-licensed event platform you can deploy on your own servers. Zero fees, full control, Docker-ready. Ticketing, RSVPs, member management.',
		keywords:
			'self hosted event management, open source ticketing, self hosted eventbrite, event management software, docker event platform'
	},
	hero: {
		headline: 'Your Events, Your Servers, Zero Fees',
		subheadline:
			'MIT-licensed event management you can deploy anywhere. Full ticketing, RSVPs, and community tools—completely under your control.'
	},
	intro: {
		paragraphs: [
			"Why pay monthly SaaS fees and trust a corporation with your community's data? Revel is open-source event management software you can deploy on your own infrastructure in minutes.",
			'Built with modern technologies—Django, PostgreSQL, Redis, and Docker—Revel is production-ready and battle-tested. Full ticketing with Stripe integration, RSVPs, member management, attendee screening, QR check-in, and more. All the features of commercial platforms, without the recurring costs or data concerns.',
			'MIT licensed means you can use it, modify it, and deploy it however you want. No vendor lock-in. No surprise pricing changes. No platform deciding what events you can run. Your infrastructure, your rules.'
		]
	},
	features: [
		{
			icon: 'server',
			title: 'Docker-Ready Deployment',
			description:
				'Get running in minutes with Docker Compose. PostgreSQL, Redis, Celery—all configured and ready to go.'
		},
		{
			icon: 'euro',
			title: 'Zero Platform Fees',
			description:
				"No per-ticket fees, no monthly costs. You only pay for your own infrastructure and Stripe's payment processing."
		},
		{
			icon: 'code',
			title: 'MIT Licensed',
			description:
				"Use it commercially, modify it, contribute back—or don't. No restrictions, no copyleft requirements."
		},
		{
			icon: 'lock',
			title: 'Complete Data Control',
			description:
				'Your data never leaves your servers. Full GDPR compliance because you control everything.'
		},
		{
			icon: 'ticket',
			title: 'Full Feature Set',
			description:
				'Ticketing, RSVPs, organizations, memberships, questionnaires, QR check-in, potluck coordination, and more.'
		},
		{
			icon: 'globe',
			title: 'Modern API',
			description:
				'REST API with OpenAPI documentation. Build custom frontends, integrations, or mobile apps.'
		}
	],
	benefits: {
		title: 'Why Self-Host Revel',
		items: [
			'Eliminate recurring SaaS costs—pay only for your infrastructure',
			'Complete data sovereignty and privacy',
			'No risk of platform policy changes or price increases',
			'Customize and extend the codebase for your needs',
			'Deploy in any region for data compliance',
			'Active community and development'
		]
	},
	cta: {
		title: 'Deploy in Minutes',
		description: 'Check out the code, read the docs, or try the hosted demo first.',
		buttons: [
			{ text: 'View on GitHub', href: 'https://github.com/letsrevel', variant: 'primary' },
			{ text: 'Try the Demo', href: 'https://demo.letsrevel.io', variant: 'secondary' },
			{ text: 'Contact Us', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'What are the system requirements?',
			answer:
				"Revel runs anywhere Docker runs. Minimum recommended: 2 CPU cores, 4GB RAM, 20GB storage. For production with many events, we recommend 4+ cores and 8GB+ RAM. You'll also need PostgreSQL (with PostGIS), Redis, and a Stripe account for payments."
		},
		{
			question: 'How long does deployment take?',
			answer:
				'With Docker Compose, you can have a working instance in under 10 minutes. The repository includes complete deployment configurations and documentation.'
		},
		{
			question: 'Can I still get support if I self-host?',
			answer:
				'Yes. We offer community support through GitHub issues. For organizations needing guaranteed response times or custom development, contact us about professional support options.'
		},
		{
			question: "What's the difference between self-hosted and your hosted version?",
			answer:
				'Functionally identical. Our hosted version adds convenience (we manage infrastructure, updates, backups) in exchange for a small per-ticket fee. Self-hosted is free but you manage everything yourself.'
		}
	],
	relatedPages: ['eventbrite-alternative', 'privacy-focused-events']
};

export const selfHostedEventPlatformDE: LandingPageContent = {
	slug: 'self-hosted-event-platform',
	locale: 'de',
	meta: {
		title: 'Selbst Gehostetes Event-Management – Open Source & Kostenlos | Revel',
		description:
			'MIT-lizenzierte Event-Plattform zum Betrieb auf eigenen Servern. Null Gebühren, volle Kontrolle, Docker-ready. Ticketing, RSVPs, Mitgliederverwaltung.',
		keywords:
			'selbst gehostetes event management, open source ticketing, self hosted eventbrite, event management software, docker event plattform'
	},
	hero: {
		headline: 'Deine Events, Deine Server, Null Gebühren',
		subheadline:
			'MIT-lizenziertes Event-Management zum überall Betreiben. Vollständiges Ticketing, RSVPs und Community-Tools – komplett unter deiner Kontrolle.'
	},
	intro: {
		paragraphs: [
			'Warum monatliche SaaS-Gebühren zahlen und einem Konzern die Daten deiner Community anvertrauen? Revel ist Open-Source Event-Management-Software, die du in Minuten auf eigener Infrastruktur betreiben kannst.',
			'Entwickelt mit modernen Technologien – Django, PostgreSQL, Redis und Docker – ist Revel produktionsreif und praxiserprobt. Vollständiges Ticketing mit Stripe-Integration, RSVPs, Mitgliederverwaltung, Teilnehmer-Screening, QR-Check-in und mehr. Alle Funktionen kommerzieller Plattformen, ohne wiederkehrende Kosten oder Datenbedenken.',
			'MIT-lizenziert bedeutet, du kannst es nutzen, modifizieren und betreiben wie du willst. Kein Vendor Lock-in. Keine überraschenden Preisänderungen. Keine Plattform, die entscheidet, welche Events du veranstalten kannst. Deine Infrastruktur, deine Regeln.'
		]
	},
	features: [
		{
			icon: 'server',
			title: 'Docker-Ready Deployment',
			description:
				'In Minuten mit Docker Compose starten. PostgreSQL, Redis, Celery – alles konfiguriert und einsatzbereit.'
		},
		{
			icon: 'euro',
			title: 'Null Plattformgebühren',
			description:
				'Keine Pro-Ticket-Gebühren, keine monatlichen Kosten. Du zahlst nur für deine eigene Infrastruktur und Stripes Zahlungsabwicklung.'
		},
		{
			icon: 'code',
			title: 'MIT Lizenziert',
			description:
				'Kommerziell nutzen, modifizieren, zurück beitragen – oder nicht. Keine Einschränkungen, keine Copyleft-Anforderungen.'
		},
		{
			icon: 'lock',
			title: 'Vollständige Datenkontrolle',
			description:
				'Deine Daten verlassen niemals deine Server. Volle DSGVO-Konformität, weil du alles kontrollierst.'
		},
		{
			icon: 'ticket',
			title: 'Vollständiger Funktionsumfang',
			description:
				'Ticketing, RSVPs, Organisationen, Mitgliedschaften, Fragebögen, QR-Check-in, Potluck-Koordination und mehr.'
		},
		{
			icon: 'globe',
			title: 'Moderne API',
			description:
				'REST API mit OpenAPI-Dokumentation. Baue eigene Frontends, Integrationen oder Mobile Apps.'
		}
	],
	benefits: {
		title: 'Warum Revel Selbst Hosten',
		items: [
			'Wiederkehrende SaaS-Kosten eliminieren – zahle nur für deine Infrastruktur',
			'Vollständige Datensouveränität und Privatsphäre',
			'Kein Risiko von Plattform-Richtlinienänderungen oder Preiserhöhungen',
			'Codebase für deine Bedürfnisse anpassen und erweitern',
			'In jeder Region für Daten-Compliance betreiben',
			'Aktive Community und Entwicklung'
		]
	},
	cta: {
		title: 'In Minuten Betreiben',
		description: 'Code ansehen, Doku lesen oder erst die gehostete Demo testen.',
		buttons: [
			{ text: 'Auf GitHub Ansehen', href: 'https://github.com/letsrevel', variant: 'primary' },
			{ text: 'Demo Testen', href: 'https://demo.letsrevel.io', variant: 'secondary' },
			{ text: 'Kontakt', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Was sind die Systemanforderungen?',
			answer:
				'Revel läuft überall wo Docker läuft. Minimum empfohlen: 2 CPU-Kerne, 4GB RAM, 20GB Speicher. Für Produktion mit vielen Events empfehlen wir 4+ Kerne und 8GB+ RAM. Du brauchst außerdem PostgreSQL (mit PostGIS), Redis und ein Stripe-Konto für Zahlungen.'
		},
		{
			question: 'Wie lange dauert das Deployment?',
			answer:
				'Mit Docker Compose kannst du in unter 10 Minuten eine funktionierende Instanz haben. Das Repository enthält vollständige Deployment-Konfigurationen und Dokumentation.'
		},
		{
			question: 'Kann ich trotzdem Support bekommen beim Selbst-Hosten?',
			answer:
				'Ja. Wir bieten Community-Support über GitHub Issues. Für Organisationen, die garantierte Reaktionszeiten oder individuelle Entwicklung brauchen, kontaktiere uns für professionelle Support-Optionen.'
		},
		{
			question: 'Was ist der Unterschied zwischen selbst gehostet und eurer gehosteten Version?',
			answer:
				'Funktional identisch. Unsere gehostete Version bietet Komfort (wir verwalten Infrastruktur, Updates, Backups) im Austausch für eine kleine Pro-Ticket-Gebühr. Selbst gehostet ist kostenlos, aber du verwaltest alles selbst.'
		}
	],
	relatedPages: ['eventbrite-alternative', 'privacy-focused-events']
};

export const selfHostedEventPlatformIT: LandingPageContent = {
	slug: 'self-hosted-event-platform',
	locale: 'it',
	meta: {
		title: 'Gestione Eventi Self-Hosted – Open Source & Gratis | Revel',
		description:
			'Piattaforma eventi MIT che puoi installare sui tuoi server. Zero commissioni, controllo totale, Docker-ready. Ticketing, RSVP, gestione membri.',
		keywords:
			'gestione eventi self hosted, ticketing open source, self hosted eventbrite, software gestione eventi, piattaforma eventi docker'
	},
	hero: {
		headline: 'I Tuoi Eventi, I Tuoi Server, Zero Commissioni',
		subheadline:
			'Gestione eventi MIT che puoi installare ovunque. Ticketing completo, RSVP e strumenti community—completamente sotto il tuo controllo.'
	},
	intro: {
		paragraphs: [
			'Perché pagare commissioni SaaS mensili e affidare i dati della tua community a una corporation? Revel è software open-source per la gestione eventi che puoi installare sulla tua infrastruttura in pochi minuti.',
			'Costruito con tecnologie moderne—Django, PostgreSQL, Redis e Docker—Revel è pronto per la produzione e testato sul campo. Ticketing completo con integrazione Stripe, RSVP, gestione membri, screening partecipanti, check-in QR e altro. Tutte le funzionalità delle piattaforme commerciali, senza costi ricorrenti o preoccupazioni sui dati.',
			'Licenza MIT significa che puoi usarlo, modificarlo e installarlo come vuoi. Nessun vendor lock-in. Nessun cambio prezzi a sorpresa. Nessuna piattaforma che decide quali eventi puoi organizzare. La tua infrastruttura, le tue regole.'
		]
	},
	features: [
		{
			icon: 'server',
			title: 'Deployment Docker-Ready',
			description:
				'Parti in minuti con Docker Compose. PostgreSQL, Redis, Celery—tutto configurato e pronto.'
		},
		{
			icon: 'euro',
			title: 'Zero Commissioni Piattaforma',
			description:
				"Nessuna commissione per biglietto, nessun costo mensile. Paghi solo la tua infrastruttura e l'elaborazione pagamenti di Stripe."
		},
		{
			icon: 'code',
			title: 'Licenza MIT',
			description:
				'Usalo commercialmente, modificalo, contribuisci—o no. Nessuna restrizione, nessun requisito copyleft.'
		},
		{
			icon: 'lock',
			title: 'Controllo Dati Completo',
			description:
				'I tuoi dati non lasciano mai i tuoi server. Piena conformità GDPR perché controlli tutto.'
		},
		{
			icon: 'ticket',
			title: 'Set Funzionalità Completo',
			description:
				'Ticketing, RSVP, organizzazioni, membership, questionari, check-in QR, coordinamento potluck e altro.'
		},
		{
			icon: 'globe',
			title: 'API Moderna',
			description:
				'REST API con documentazione OpenAPI. Costruisci frontend personalizzati, integrazioni o app mobile.'
		}
	],
	benefits: {
		title: 'Perché Fare Self-Host di Revel',
		items: [
			'Elimina i costi SaaS ricorrenti—paga solo la tua infrastruttura',
			'Completa sovranità e privacy dei dati',
			'Nessun rischio di cambi policy o aumenti prezzi della piattaforma',
			'Personalizza ed estendi il codice per le tue esigenze',
			'Installa in qualsiasi regione per conformità dati',
			'Community e sviluppo attivi'
		]
	},
	cta: {
		title: 'Installa in Pochi Minuti',
		description: 'Guarda il codice, leggi la documentazione o prova prima la demo hosted.',
		buttons: [
			{ text: 'Vedi su GitHub', href: 'https://github.com/letsrevel', variant: 'primary' },
			{ text: 'Prova la Demo', href: 'https://demo.letsrevel.io', variant: 'secondary' },
			{ text: 'Contattaci', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Quali sono i requisiti di sistema?',
			answer:
				'Revel gira ovunque giri Docker. Minimo raccomandato: 2 core CPU, 4GB RAM, 20GB storage. Per produzione con molti eventi, raccomandiamo 4+ core e 8GB+ RAM. Serviranno anche PostgreSQL (con PostGIS), Redis e un account Stripe per i pagamenti.'
		},
		{
			question: 'Quanto tempo richiede il deployment?',
			answer:
				"Con Docker Compose puoi avere un'istanza funzionante in meno di 10 minuti. Il repository include configurazioni di deployment complete e documentazione."
		},
		{
			question: 'Posso comunque avere supporto se faccio self-host?',
			answer:
				'Sì. Offriamo supporto community tramite GitHub issues. Per organizzazioni che necessitano tempi di risposta garantiti o sviluppo personalizzato, contattaci per opzioni di supporto professionale.'
		},
		{
			question: 'Qual è la differenza tra self-hosted e la vostra versione hosted?',
			answer:
				'Funzionalmente identiche. La nostra versione hosted aggiunge comodità (gestiamo infrastruttura, aggiornamenti, backup) in cambio di una piccola commissione per biglietto. Self-hosted è gratis ma gestisci tutto tu.'
		}
	],
	relatedPages: ['eventbrite-alternative', 'privacy-focused-events']
};

export const selfHostedEventPlatformFR: LandingPageContent = {
	slug: 'self-hosted-event-platform',
	locale: 'fr',
	meta: {
		title: 'Gestion d’événements auto-hébergée – Open Source et gratuite | Revel',
		description:
			'Plateforme événementielle sous licence MIT à héberger sur tes propres serveurs. Zéro commission, contrôle total, prête pour Docker. Billetterie, RSVP, gestion des membres.',
		keywords:
			'gestion d’événements auto-hébergée, billetterie open source, alternative eventbrite auto-hébergée, logiciel de gestion d’événements, plateforme événementielle docker'
	},
	hero: {
		headline: 'Tes événements, tes serveurs, zéro commission',
		subheadline:
			'Gestion d’événements sous licence MIT à déployer partout. Billetterie complète, RSVP et outils communautaires – entièrement sous ton contrôle.'
	},
	intro: {
		paragraphs: [
			'Pourquoi payer des abonnements SaaS mensuels et confier les données de ta communauté à une multinationale ? Revel est un logiciel de gestion d’événements open source que tu peux faire tourner en quelques minutes sur ta propre infrastructure.',
			'Conçu avec des technologies modernes – Django, PostgreSQL, Redis et Docker – Revel est prêt pour la production et éprouvé sur le terrain. Billetterie complète avec intégration Stripe, RSVP, gestion des membres, sélection des participants, check-in par QR code et bien plus. Toutes les fonctionnalités des plateformes commerciales, sans coûts récurrents ni inquiétudes sur tes données.',
			'La licence MIT signifie que tu peux l’utiliser, le modifier et l’exploiter comme tu veux. Aucun verrouillage propriétaire. Aucune hausse de tarif surprise. Aucune plateforme qui décide quels événements tu as le droit d’organiser. Ton infrastructure, tes règles.'
		]
	},
	features: [
		{
			icon: 'server',
			title: 'Déploiement prêt pour Docker',
			description:
				'Lance-toi en quelques minutes avec Docker Compose. PostgreSQL, Redis, Celery – tout est configuré et prêt à l’emploi.'
		},
		{
			icon: 'euro',
			title: 'Zéro commission de plateforme',
			description:
				'Aucuns frais par billet, aucun coût mensuel. Tu ne paies que ta propre infrastructure et le traitement des paiements par Stripe.'
		},
		{
			icon: 'code',
			title: 'Sous licence MIT',
			description:
				'Utilise-le à des fins commerciales, modifie-le, contribue en retour – ou pas. Aucune restriction, aucune obligation copyleft.'
		},
		{
			icon: 'lock',
			title: 'Contrôle total des données',
			description:
				'Tes données ne quittent jamais tes serveurs. Conformité RGPD totale, parce que c’est toi qui contrôles tout.'
		},
		{
			icon: 'ticket',
			title: 'Toutes les fonctionnalités incluses',
			description:
				'Billetterie, RSVP, organisations, adhésions, questionnaires, check-in par QR code, coordination des repas partagés et plus encore.'
		},
		{
			icon: 'globe',
			title: 'API moderne',
			description:
				'API REST avec documentation OpenAPI. Crée tes propres interfaces, intégrations ou applications mobiles.'
		}
	],
	benefits: {
		title: 'Pourquoi auto-héberger Revel',
		items: [
			'Élimine les coûts SaaS récurrents – ne paie que ton infrastructure',
			'Souveraineté et confidentialité totales sur tes données',
			'Aucun risque de changement de politique de plateforme ni de hausse de tarifs',
			'Adapte et étends le code source selon tes besoins',
			'Héberge dans n’importe quelle région pour la conformité des données',
			'Une communauté et un développement actifs'
		]
	},
	cta: {
		title: 'En ligne en quelques minutes',
		description: 'Consulte le code, lis la doc, ou teste d’abord la démo hébergée.',
		buttons: [
			{ text: 'Voir sur GitHub', href: 'https://github.com/letsrevel', variant: 'primary' },
			{ text: 'Tester la démo', href: 'https://demo.letsrevel.io', variant: 'secondary' },
			{ text: 'Nous contacter', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Quelle est la configuration requise ?',
			answer:
				'Revel tourne partout où Docker fonctionne. Minimum recommandé : 2 cœurs CPU, 4 Go de RAM, 20 Go de stockage. Pour une production avec beaucoup d’événements, nous recommandons 4 cœurs ou plus et 8 Go de RAM ou plus. Il te faut aussi PostgreSQL (avec PostGIS), Redis et un compte Stripe pour les paiements.'
		},
		{
			question: 'Combien de temps prend le déploiement ?',
			answer:
				'Avec Docker Compose, tu peux avoir une instance fonctionnelle en moins de 10 minutes. Le dépôt contient des configurations de déploiement et une documentation complètes.'
		},
		{
			question: 'Puis-je quand même obtenir du support en auto-hébergement ?',
			answer:
				'Oui. Nous proposons un support communautaire via les issues GitHub. Pour les organisations qui ont besoin de délais de réponse garantis ou de développements sur mesure, contacte-nous pour découvrir nos options de support professionnel.'
		},
		{
			question: 'Quelle est la différence entre l’auto-hébergement et votre version hébergée ?',
			answer:
				'Les fonctionnalités sont identiques. Notre version hébergée offre le confort (nous gérons l’infrastructure, les mises à jour, les sauvegardes) en échange d’une petite commission par billet. L’auto-hébergement est gratuit, mais c’est toi qui gères tout.'
		}
	],
	relatedPages: ['eventbrite-alternative', 'privacy-focused-events']
};
