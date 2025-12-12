/**
 * Landing page content data for SEO pages
 * Each page targets specific keywords and audiences with tailored messaging
 */

export interface LandingPageFeature {
	icon: 'ticket' | 'shield' | 'users' | 'server' | 'eye' | 'check' | 'euro' | 'lock' | 'heart' | 'globe' | 'code' | 'clipboard';
	title: string;
	description: string;
}

export interface LandingPageCTA {
	text: string;
	href: string;
	variant: 'primary' | 'secondary' | 'outline';
}

export interface LandingPageContent {
	slug: string;
	locale: 'en' | 'de' | 'it';
	meta: {
		title: string;
		description: string;
		keywords: string;
	};
	hero: {
		headline: string;
		subheadline: string;
	};
	intro: {
		paragraphs: string[];
	};
	features: LandingPageFeature[];
	benefits: {
		title: string;
		items: string[];
	};
	cta: {
		title: string;
		description: string;
		buttons: LandingPageCTA[];
	};
	faq: Array<{
		question: string;
		answer: string;
	}>;
	relatedPages: string[];
}

export type LandingPageSlug =
	| 'eventbrite-alternative'
	| 'queer-event-management'
	| 'kink-event-ticketing'
	| 'self-hosted-event-platform'
	| 'privacy-focused-events';

// =============================================================================
// ENGLISH CONTENT
// =============================================================================

const eventbriteAlternativeEN: LandingPageContent = {
	slug: 'eventbrite-alternative',
	locale: 'en',
	meta: {
		title: 'Eventbrite Alternative – Lower Fees, Full Control | Revel',
		description: 'Open-source event ticketing with just 1.5% + €0.25 per ticket. Self-host for zero fees. Own your data. No platform lock-in. Hosted in Europe.',
		keywords: 'eventbrite alternative, cheap event ticketing, low fee ticketing, event platform, ticketing software'
	},
	hero: {
		headline: 'Stop Losing Money to Platform Fees',
		subheadline: 'Revel is the open-source Eventbrite alternative with transparent pricing and full data ownership.'
	},
	intro: {
		paragraphs: [
			'Tired of Eventbrite taking 3.7% plus fees from every ticket sold? You\'re not alone. Event organizers everywhere are looking for alternatives that don\'t eat into their margins or lock them into a platform they can\'t control.',
			'Revel is an open-source event management platform with simple, fair pricing: just 1.5% + €0.25 per paid ticket on our hosted version—or completely free if you self-host. Your ticket revenue goes to you, not to a corporation.',
			'Built by community organizers in Europe, Revel gives you everything you need: ticketing, RSVPs, attendee management, check-in tools, and more. All while keeping your data yours and your costs predictable.'
		]
	},
	features: [
		{
			icon: 'euro',
			title: 'Transparent, Low Fees',
			description: 'Just 1.5% + €0.25 per paid ticket. Free events are always free. Self-host and pay nothing at all.'
		},
		{
			icon: 'server',
			title: 'Self-Host Option',
			description: 'Deploy Revel on your own infrastructure with Docker. Zero platform fees, complete control, MIT licensed.'
		},
		{
			icon: 'ticket',
			title: 'Full Ticketing Suite',
			description: 'Multiple ticket tiers, batch purchases, QR code check-in, Apple Wallet integration, and Stripe-powered payments.'
		},
		{
			icon: 'shield',
			title: 'Your Data, Your Rules',
			description: 'No third-party trackers. No data selling. Full GDPR compliance. Hosted on European infrastructure.'
		},
		{
			icon: 'users',
			title: 'Community Tools',
			description: 'Organizations, memberships, roles and permissions. Build lasting communities, not just one-off events.'
		},
		{
			icon: 'code',
			title: 'Open Source (MIT)',
			description: 'Fully transparent codebase. Audit it, modify it, contribute to it. No vendor lock-in, ever.'
		}
	],
	benefits: {
		title: 'Why Organizers Choose Revel',
		items: [
			'Keep more of your ticket revenue with fees up to 60% lower than Eventbrite',
			'Direct Stripe payouts—no waiting for platform disbursements',
			'Export your attendee data anytime, in standard formats',
			'No risk of platform policy changes shutting down your events',
			'European hosting with full GDPR compliance',
			'Active development by a community that listens'
		]
	},
	cta: {
		title: 'Ready to Switch?',
		description: 'See Revel in action or deploy it yourself. No credit card required.',
		buttons: [
			{ text: 'Try the Live Demo', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Self-Host (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Contact Us', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'How does Revel compare to Eventbrite pricing?',
			answer: 'Eventbrite charges around 3.7% + fees per ticket, plus payment processing. Revel charges just 1.5% + €0.25 per paid ticket (plus Stripe\'s standard ~1.5% + €0.25). Free events and self-hosted deployments have zero platform fees.'
		},
		{
			question: 'Can I migrate my events from Eventbrite?',
			answer: 'Yes. Revel makes it easy to recreate your events with our intuitive event builder. You can export your attendee lists from Eventbrite as CSV and use them to invite your existing community to your new Revel events.'
		},
		{
			question: 'Is Revel really free to self-host?',
			answer: 'Absolutely. Revel is MIT licensed, which means you can run it on your own servers without paying us anything. You only pay for your own infrastructure and Stripe\'s payment processing fees.'
		},
		{
			question: 'Where is Revel hosted?',
			answer: 'Our hosted version runs on European infrastructure, ensuring GDPR compliance and data sovereignty. If you self-host, you choose where your data lives.'
		}
	],
	relatedPages: ['self-hosted-event-platform', 'privacy-focused-events']
};

const queerEventManagementEN: LandingPageContent = {
	slug: 'queer-event-management',
	locale: 'en',
	meta: {
		title: 'Event Management for LGBTQ+ Communities | Revel',
		description: 'Open-source event platform built by and for queer communities. Privacy controls, attendee screening, no censorship risk. Hosted in Europe.',
		keywords: 'lgbtq event platform, queer event management, gay event ticketing, pride events, queer community'
	},
	hero: {
		headline: 'Event Software That Gets Queer Communities',
		subheadline: 'Built by LGBTQ+ organizers for events that mainstream platforms weren\'t designed to support.'
	},
	intro: {
		paragraphs: [
			'Mainstream event platforms weren\'t built with queer communities in mind. Vague content policies that flag your events. Algorithms that suppress visibility. No understanding of safer spaces or community-specific needs.',
			'Revel is different. Created by queer event organizers in Europe, it\'s an open-source platform designed for communities that need more than just ticketing—they need trust, privacy, and the freedom to run events without fear of deplatforming.',
			'Whether you\'re organizing Pride parties, queer meetups, drag shows, or community gatherings, Revel gives you the tools to build and protect your community. Member management, attendee screening, visibility controls, and complete data ownership—all in one platform.'
		]
	},
	features: [
		{
			icon: 'heart',
			title: 'Built for Community',
			description: 'Organizations, memberships, and community-building tools. Create spaces where your community can thrive beyond single events.'
		},
		{
			icon: 'shield',
			title: 'No Censorship Risk',
			description: 'Self-host or use our European servers. No corporate content policies deciding what events you can run.'
		},
		{
			icon: 'clipboard',
			title: 'Attendee Screening',
			description: 'Custom questionnaires to ensure attendees align with your community values. Manual review, auto-approval, or hybrid workflows.'
		},
		{
			icon: 'eye',
			title: 'Privacy Controls',
			description: 'Public, members-only, or invite-only events. Control who sees what, and keep attendee lists private.'
		},
		{
			icon: 'lock',
			title: 'Data Sovereignty',
			description: 'Your community\'s data stays yours. No third-party trackers, no data selling, full GDPR compliance.'
		},
		{
			icon: 'globe',
			title: 'European Hosting',
			description: 'Hosted on European infrastructure with strong privacy protections. Self-host anywhere you choose.'
		}
	],
	benefits: {
		title: 'Why LGBTQ+ Organizers Trust Revel',
		items: [
			'No risk of events being flagged or removed by platform policies',
			'Screen attendees to maintain safer spaces',
			'Build lasting community membership, not just event-by-event lists',
			'Full control over your community\'s data',
			'Created by people who understand queer event organizing',
			'Open source and transparent—see exactly how it works'
		]
	},
	cta: {
		title: 'Your Community Deserves Better Tools',
		description: 'See how Revel works or start building your community today.',
		buttons: [
			{ text: 'Try the Live Demo', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Self-Host (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Contact Us', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'What makes Revel different from Eventbrite or Meetup?',
			answer: 'Revel was built specifically for communities that need privacy, screening, and freedom from platform censorship. We don\'t have content policies that restrict adult or queer events, and we give you full control over your data.'
		},
		{
			question: 'Can I screen who attends my events?',
			answer: 'Yes. Revel includes a powerful questionnaire system that lets you require attendees to answer questions before purchasing tickets or RSVPing. You can review submissions manually, set up auto-approval rules, or use a hybrid approach.'
		},
		{
			question: 'Is my community\'s data safe?',
			answer: 'Absolutely. We don\'t sell data or use third-party trackers. Our hosted version runs on European servers with GDPR compliance. If you self-host, you have complete control over where your data lives.'
		},
		{
			question: 'Can I run members-only events?',
			answer: 'Yes. You can create organizations with membership tiers and restrict events to members only, specific membership levels, or make them public. You control visibility at every level.'
		}
	],
	relatedPages: ['kink-event-ticketing', 'privacy-focused-events']
};

const kinkEventTicketingEN: LandingPageContent = {
	slug: 'kink-event-ticketing',
	locale: 'en',
	meta: {
		title: 'Ticketing for Kink & BDSM Events – Private & Secure | Revel',
		description: 'Event management for kink, BDSM, and sex-positive communities. Attendee screening, privacy controls, discretion. Open-source, self-hostable.',
		keywords: 'bdsm event ticketing, kink event management, sex positive events, fetish party ticketing, adult event platform'
	},
	hero: {
		headline: 'Discreet Event Management for Kink Communities',
		subheadline: 'Attendee screening, privacy controls, and complete data ownership. Built for events that need discretion.'
	},
	intro: {
		paragraphs: [
			'Organizing kink and BDSM events means balancing privacy, consent, and trust—while still handling the logistics of ticketing, RSVPs, and attendee management. Most platforms aren\'t built for this. Revel is.',
			'Created by community organizers who understand the unique needs of sex-positive spaces, Revel is open-source event software designed for discretion. Screen attendees with custom questionnaires. Control exactly who sees your events. Keep attendee data completely private.',
			'Whether you\'re running play parties, munches, workshops, or large fetish events, Revel gives you the tools to maintain the trust and safety your community expects—without compromising on features or worrying about platform censorship.'
		]
	},
	features: [
		{
			icon: 'clipboard',
			title: 'Attendee Screening',
			description: 'Require questionnaires before ticket purchase. Review applications manually, auto-approve based on criteria, or use hybrid workflows.'
		},
		{
			icon: 'eye',
			title: 'Visibility Controls',
			description: 'Public listings, members-only, or completely private invite-only events. You decide who knows about your events.'
		},
		{
			icon: 'lock',
			title: 'Complete Discretion',
			description: 'No platform that can leak your attendee list. Self-host for maximum privacy, or use our secure European servers.'
		},
		{
			icon: 'shield',
			title: 'No Deplatforming Risk',
			description: 'Open source and self-hostable. No corporate content policies. Your events, your rules.'
		},
		{
			icon: 'users',
			title: 'Community Membership',
			description: 'Build trusted member lists over time. Restrict events to vetted community members.'
		},
		{
			icon: 'ticket',
			title: 'Full Event Features',
			description: 'Multiple ticket tiers, QR check-in, Apple Wallet passes, batch purchases—everything you need to run professional events.'
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
			answer: 'You create questionnaires with any questions you need—experience level, community references, consent acknowledgments, etc. Attendees must complete the questionnaire before they can purchase tickets. You can review submissions manually, set auto-approval rules, or combine both approaches.'
		},
		{
			question: 'Can I keep my events completely private?',
			answer: 'Yes. Events can be set to invite-only, visible only to members, or completely unlisted. You can also send direct invitations that bypass normal requirements for trusted guests.'
		},
		{
			question: 'What if I need maximum privacy?',
			answer: 'Self-host Revel on your own infrastructure. Your data never touches our servers. The software is MIT licensed and free to use—you only pay for your own hosting and Stripe payment processing.'
		},
		{
			question: 'Is there any risk of my events being censored?',
			answer: 'Not with Revel. We\'re open source with no content policies restricting adult events. If you self-host, you have complete autonomy. Our hosted version is run on European infrastructure and we explicitly support sex-positive communities.'
		}
	],
	relatedPages: ['queer-event-management', 'privacy-focused-events', 'self-hosted-event-platform']
};

const selfHostedEventPlatformEN: LandingPageContent = {
	slug: 'self-hosted-event-platform',
	locale: 'en',
	meta: {
		title: 'Self-Hosted Event Management – Open Source & Free | Revel',
		description: 'MIT-licensed event platform you can deploy on your own servers. Zero fees, full control, Docker-ready. Ticketing, RSVPs, member management.',
		keywords: 'self hosted event management, open source ticketing, self hosted eventbrite, event management software, docker event platform'
	},
	hero: {
		headline: 'Your Events, Your Servers, Zero Fees',
		subheadline: 'MIT-licensed event management you can deploy anywhere. Full ticketing, RSVPs, and community tools—completely under your control.'
	},
	intro: {
		paragraphs: [
			'Why pay monthly SaaS fees and trust a corporation with your community\'s data? Revel is open-source event management software you can deploy on your own infrastructure in minutes.',
			'Built with modern technologies—Django, PostgreSQL, Redis, and Docker—Revel is production-ready and battle-tested. Full ticketing with Stripe integration, RSVPs, member management, attendee screening, QR check-in, and more. All the features of commercial platforms, without the recurring costs or data concerns.',
			'MIT licensed means you can use it, modify it, and deploy it however you want. No vendor lock-in. No surprise pricing changes. No platform deciding what events you can run. Your infrastructure, your rules.'
		]
	},
	features: [
		{
			icon: 'server',
			title: 'Docker-Ready Deployment',
			description: 'Get running in minutes with Docker Compose. PostgreSQL, Redis, Celery—all configured and ready to go.'
		},
		{
			icon: 'euro',
			title: 'Zero Platform Fees',
			description: 'No per-ticket fees, no monthly costs. You only pay for your own infrastructure and Stripe\'s payment processing.'
		},
		{
			icon: 'code',
			title: 'MIT Licensed',
			description: 'Use it commercially, modify it, contribute back—or don\'t. No restrictions, no copyleft requirements.'
		},
		{
			icon: 'lock',
			title: 'Complete Data Control',
			description: 'Your data never leaves your servers. Full GDPR compliance because you control everything.'
		},
		{
			icon: 'ticket',
			title: 'Full Feature Set',
			description: 'Ticketing, RSVPs, organizations, memberships, questionnaires, QR check-in, potluck coordination, and more.'
		},
		{
			icon: 'globe',
			title: 'Modern API',
			description: 'REST API with OpenAPI documentation. Build custom frontends, integrations, or mobile apps.'
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
			answer: 'Revel runs anywhere Docker runs. Minimum recommended: 2 CPU cores, 4GB RAM, 20GB storage. For production with many events, we recommend 4+ cores and 8GB+ RAM. You\'ll also need PostgreSQL (with PostGIS), Redis, and a Stripe account for payments.'
		},
		{
			question: 'How long does deployment take?',
			answer: 'With Docker Compose, you can have a working instance in under 10 minutes. The repository includes complete deployment configurations and documentation.'
		},
		{
			question: 'Can I still get support if I self-host?',
			answer: 'Yes. We offer community support through GitHub issues. For organizations needing guaranteed response times or custom development, contact us about professional support options.'
		},
		{
			question: 'What\'s the difference between self-hosted and your hosted version?',
			answer: 'Functionally identical. Our hosted version adds convenience (we manage infrastructure, updates, backups) in exchange for a small per-ticket fee. Self-hosted is free but you manage everything yourself.'
		}
	],
	relatedPages: ['eventbrite-alternative', 'privacy-focused-events']
};

const privacyFocusedEventsEN: LandingPageContent = {
	slug: 'privacy-focused-events',
	locale: 'en',
	meta: {
		title: 'Privacy-First Event Platform – GDPR Compliant | Revel',
		description: 'Event management that respects privacy. No data harvesting, no third-party trackers. European hosting, full GDPR compliance. Open source.',
		keywords: 'gdpr event platform, privacy focused events, european event software, data protection events, private event management'
	},
	hero: {
		headline: 'Event Management That Respects Privacy',
		subheadline: 'No data harvesting. No third-party trackers. European hosting with full GDPR compliance.'
	},
	intro: {
		paragraphs: [
			'Most event platforms harvest your attendee data for advertising, share it with third parties, and bury the details in lengthy privacy policies. If you care about your community\'s privacy—or simply need to comply with GDPR—you need a different approach.',
			'Revel is open-source event management built with privacy as a core principle, not an afterthought. We don\'t track users across the web. We don\'t sell data. We don\'t even have the business model that would incentivize us to do so.',
			'Hosted on European infrastructure with full GDPR compliance, or self-host for complete control. Your attendee data stays yours, and your community can trust that their information is handled responsibly.'
		]
	},
	features: [
		{
			icon: 'shield',
			title: 'No Third-Party Trackers',
			description: 'No Google Analytics, no Facebook pixels, no advertising SDKs. We don\'t track your attendees across the web.'
		},
		{
			icon: 'globe',
			title: 'European Hosting',
			description: 'Our hosted version runs on European infrastructure, ensuring your data stays under EU jurisdiction and GDPR protection.'
		},
		{
			icon: 'lock',
			title: 'Data Minimization',
			description: 'We collect only what\'s needed to run events. No building profiles, no behavioral analysis, no data monetization.'
		},
		{
			icon: 'server',
			title: 'Self-Host Option',
			description: 'For maximum control, deploy Revel on your own infrastructure. Your data never touches our servers.'
		},
		{
			icon: 'code',
			title: 'Transparent Codebase',
			description: 'Open source means you can audit exactly how your data is handled. No hidden tracking, no surprises.'
		},
		{
			icon: 'check',
			title: 'GDPR by Design',
			description: 'Data export, deletion requests, consent management—privacy compliance is built into the platform.'
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
			answer: 'We practice data minimization, provide data export and deletion tools, obtain proper consent, and host on European infrastructure. As open source, you can audit our data practices directly in the code.'
		},
		{
			question: 'Do you sell attendee data?',
			answer: 'No. We have no advertising business model. Our revenue comes from a small per-ticket fee on paid events (for hosted customers). We have no incentive to monetize your data.'
		},
		{
			question: 'What data do you collect?',
			answer: 'Only what\'s necessary: account information, event details, ticket purchases, and attendee lists. We don\'t track browsing behavior, build advertising profiles, or collect data beyond what you explicitly provide.'
		},
		{
			question: 'Can I get complete data control?',
			answer: 'Yes. Self-host Revel on your own infrastructure and your data never touches our servers. The platform is MIT licensed and free to deploy.'
		}
	],
	relatedPages: ['self-hosted-event-platform', 'queer-event-management']
};

// =============================================================================
// GERMAN CONTENT
// =============================================================================

const eventbriteAlternativeDE: LandingPageContent = {
	slug: 'eventbrite-alternative',
	locale: 'de',
	meta: {
		title: 'Eventbrite-Alternative – Niedrige Gebühren, Volle Kontrolle | Revel',
		description: 'Open-Source Event-Ticketing mit nur 1,5% + 0,25€ pro Ticket. Selbst hosten für null Gebühren. Eigene Daten. Kein Plattform-Lock-in. Gehostet in Europa.',
		keywords: 'eventbrite alternative, günstige ticketing plattform, event software, ticketing system, veranstaltungsmanagement'
	},
	hero: {
		headline: 'Schluss mit hohen Plattformgebühren',
		subheadline: 'Revel ist die Open-Source Eventbrite-Alternative mit transparenten Preisen und voller Datenkontrolle.'
	},
	intro: {
		paragraphs: [
			'Frustriert von Eventbrite, das 3,7% plus Gebühren von jedem verkauften Ticket nimmt? Du bist nicht allein. Veranstalter überall suchen nach Alternativen, die nicht ihre Margen auffressen oder sie an eine unkontrollierbare Plattform binden.',
			'Revel ist eine Open-Source Event-Management-Plattform mit einfacher, fairer Preisgestaltung: nur 1,5% + 0,25€ pro bezahltem Ticket bei unserer gehosteten Version – oder komplett kostenlos bei Selbst-Hosting. Deine Ticketeinnahmen gehören dir, nicht einem Konzern.',
			'Entwickelt von Community-Organisatoren in Europa, bietet Revel alles was du brauchst: Ticketing, RSVPs, Teilnehmerverwaltung, Check-in-Tools und mehr. Alles während deine Daten dir gehören und deine Kosten planbar bleiben.'
		]
	},
	features: [
		{
			icon: 'euro',
			title: 'Transparente, Niedrige Gebühren',
			description: 'Nur 1,5% + 0,25€ pro bezahltem Ticket. Kostenlose Events sind immer kostenlos. Selbst hosten und gar nichts zahlen.'
		},
		{
			icon: 'server',
			title: 'Selbst-Hosting Option',
			description: 'Revel mit Docker auf eigener Infrastruktur betreiben. Null Plattformgebühren, volle Kontrolle, MIT-lizenziert.'
		},
		{
			icon: 'ticket',
			title: 'Vollständige Ticketing-Suite',
			description: 'Mehrere Ticket-Stufen, Sammelkäufe, QR-Code Check-in, Apple Wallet Integration und Stripe-basierte Zahlungen.'
		},
		{
			icon: 'shield',
			title: 'Deine Daten, Deine Regeln',
			description: 'Keine Drittanbieter-Tracker. Kein Datenverkauf. Volle DSGVO-Konformität. Auf europäischer Infrastruktur gehostet.'
		},
		{
			icon: 'users',
			title: 'Community-Tools',
			description: 'Organisationen, Mitgliedschaften, Rollen und Berechtigungen. Baue nachhaltige Communities, nicht nur einzelne Events.'
		},
		{
			icon: 'code',
			title: 'Open Source (MIT)',
			description: 'Vollständig transparenter Code. Prüfe ihn, modifiziere ihn, trage bei. Kein Vendor Lock-in, niemals.'
		}
	],
	benefits: {
		title: 'Warum Veranstalter Revel Wählen',
		items: [
			'Behalte mehr von deinen Ticketeinnahmen mit bis zu 60% niedrigeren Gebühren als Eventbrite',
			'Direkte Stripe-Auszahlungen – kein Warten auf Plattform-Auszahlungen',
			'Exportiere deine Teilnehmerdaten jederzeit in Standardformaten',
			'Kein Risiko, dass Plattform-Richtlinienänderungen deine Events lahmlegen',
			'Europäisches Hosting mit voller DSGVO-Konformität',
			'Aktive Entwicklung von einer Community, die zuhört'
		]
	},
	cta: {
		title: 'Bereit zum Wechseln?',
		description: 'Sieh Revel in Aktion oder betreibe es selbst. Keine Kreditkarte erforderlich.',
		buttons: [
			{ text: 'Live-Demo Testen', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Selbst Hosten (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Kontakt', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Wie vergleichen sich Revels Preise mit Eventbrite?',
			answer: 'Eventbrite berechnet etwa 3,7% + Gebühren pro Ticket, plus Zahlungsabwicklung. Revel berechnet nur 1,5% + 0,25€ pro bezahltem Ticket (plus Stripes Standard ~1,5% + 0,25€). Kostenlose Events und selbst gehostete Deployments haben null Plattformgebühren.'
		},
		{
			question: 'Kann ich meine Events von Eventbrite migrieren?',
			answer: 'Ja. Mit Revel kannst du deine Events ganz einfach mit unserem intuitiven Event-Builder neu erstellen. Du kannst deine Teilnehmerlisten von Eventbrite als CSV exportieren und sie nutzen, um deine bestehende Community zu deinen neuen Revel-Events einzuladen.'
		},
		{
			question: 'Ist Revel wirklich kostenlos zum Selbst-Hosten?',
			answer: 'Absolut. Revel ist MIT-lizenziert, was bedeutet, dass du es auf eigenen Servern betreiben kannst, ohne uns etwas zu zahlen. Du zahlst nur für deine eigene Infrastruktur und Stripes Zahlungsgebühren.'
		},
		{
			question: 'Wo wird Revel gehostet?',
			answer: 'Unsere gehostete Version läuft auf europäischer Infrastruktur und gewährleistet DSGVO-Konformität und Datensouveränität. Beim Selbst-Hosting entscheidest du, wo deine Daten liegen.'
		}
	],
	relatedPages: ['self-hosted-event-platform', 'privacy-focused-events']
};

const queerEventManagementDE: LandingPageContent = {
	slug: 'queer-event-management',
	locale: 'de',
	meta: {
		title: 'Event-Management für LGBTQ+ Communities | Revel',
		description: 'Open-Source Event-Plattform von und für queere Communities. Datenschutzkontrollen, Teilnehmer-Screening, kein Zensurrisiko. Gehostet in Europa.',
		keywords: 'lgbtq event plattform, queere veranstaltungen, gay event ticketing, pride events, queer community'
	},
	hero: {
		headline: 'Event-Software, Die Queere Communities Versteht',
		subheadline: 'Entwickelt von LGBTQ+ Organisatoren für Events, die Mainstream-Plattformen nicht unterstützen können.'
	},
	intro: {
		paragraphs: [
			'Mainstream Event-Plattformen wurden nicht mit queeren Communities im Sinn entwickelt. Vage Inhaltsrichtlinien, die deine Events markieren. Algorithmen, die die Sichtbarkeit unterdrücken. Kein Verständnis für Safer Spaces oder community-spezifische Bedürfnisse.',
			'Revel ist anders. Entwickelt von queeren Event-Organisatoren in Europa, ist es eine Open-Source-Plattform für Communities, die mehr als nur Ticketing brauchen – sie brauchen Vertrauen, Privatsphäre und die Freiheit, Events ohne Angst vor Deplatforming zu veranstalten.',
			'Ob du Pride-Partys, queere Meetups, Drag-Shows oder Community-Treffen organisierst – Revel gibt dir die Werkzeuge, um deine Community aufzubauen und zu schützen. Mitgliederverwaltung, Teilnehmer-Screening, Sichtbarkeitskontrollen und vollständige Datenhoheit – alles in einer Plattform.'
		]
	},
	features: [
		{
			icon: 'heart',
			title: 'Für Community Gebaut',
			description: 'Organisationen, Mitgliedschaften und Community-Building-Tools. Schaffe Räume, in denen deine Community über einzelne Events hinaus gedeihen kann.'
		},
		{
			icon: 'shield',
			title: 'Kein Zensurrisiko',
			description: 'Selbst hosten oder unsere europäischen Server nutzen. Keine Unternehmens-Inhaltsrichtlinien, die entscheiden, welche Events du veranstalten kannst.'
		},
		{
			icon: 'clipboard',
			title: 'Teilnehmer-Screening',
			description: 'Individuelle Fragebögen, um sicherzustellen, dass Teilnehmer zu den Werten deiner Community passen. Manuelle Prüfung, automatische Genehmigung oder Hybrid-Workflows.'
		},
		{
			icon: 'eye',
			title: 'Datenschutzkontrollen',
			description: 'Öffentliche, nur für Mitglieder oder nur auf Einladung zugängliche Events. Kontrolliere, wer was sieht, und halte Teilnehmerlisten privat.'
		},
		{
			icon: 'lock',
			title: 'Datensouveränität',
			description: 'Die Daten deiner Community bleiben deine. Keine Drittanbieter-Tracker, kein Datenverkauf, volle DSGVO-Konformität.'
		},
		{
			icon: 'globe',
			title: 'Europäisches Hosting',
			description: 'Gehostet auf europäischer Infrastruktur mit starkem Datenschutz. Selbst hosten wo immer du möchtest.'
		}
	],
	benefits: {
		title: 'Warum LGBTQ+ Organisatoren Revel Vertrauen',
		items: [
			'Kein Risiko, dass Events durch Plattform-Richtlinien markiert oder entfernt werden',
			'Teilnehmer screenen für sicherere Räume',
			'Nachhaltige Community-Mitgliedschaften aufbauen, nicht nur Event-für-Event-Listen',
			'Volle Kontrolle über die Daten deiner Community',
			'Entwickelt von Menschen, die queere Event-Organisation verstehen',
			'Open Source und transparent – sieh genau, wie es funktioniert'
		]
	},
	cta: {
		title: 'Deine Community Verdient Bessere Tools',
		description: 'Sieh wie Revel funktioniert oder beginne heute mit dem Aufbau deiner Community.',
		buttons: [
			{ text: 'Live-Demo Testen', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Selbst Hosten (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Kontakt', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Was macht Revel anders als Eventbrite oder Meetup?',
			answer: 'Revel wurde speziell für Communities entwickelt, die Privatsphäre, Screening und Freiheit von Plattformzensur brauchen. Wir haben keine Inhaltsrichtlinien, die Adult- oder queere Events einschränken, und wir geben dir volle Kontrolle über deine Daten.'
		},
		{
			question: 'Kann ich kontrollieren, wer an meinen Events teilnimmt?',
			answer: 'Ja. Revel enthält ein leistungsfähiges Fragebogensystem, mit dem du von Teilnehmern verlangen kannst, Fragen zu beantworten, bevor sie Tickets kaufen oder RSVPen. Du kannst Einreichungen manuell prüfen, Auto-Genehmigungs-Regeln einrichten oder einen Hybrid-Ansatz verwenden.'
		},
		{
			question: 'Sind die Daten meiner Community sicher?',
			answer: 'Absolut. Wir verkaufen keine Daten und verwenden keine Drittanbieter-Tracker. Unsere gehostete Version läuft auf europäischen Servern mit DSGVO-Konformität. Beim Selbst-Hosting hast du die komplette Kontrolle darüber, wo deine Daten liegen.'
		},
		{
			question: 'Kann ich nur für Mitglieder zugängliche Events veranstalten?',
			answer: 'Ja. Du kannst Organisationen mit Mitgliedschaftsstufen erstellen und Events nur auf Mitglieder, bestimmte Mitgliedschaftsstufen beschränken oder sie öffentlich machen. Du kontrollierst die Sichtbarkeit auf jeder Ebene.'
		}
	],
	relatedPages: ['kink-event-ticketing', 'privacy-focused-events']
};

const kinkEventTicketingDE: LandingPageContent = {
	slug: 'kink-event-ticketing',
	locale: 'de',
	meta: {
		title: 'Ticketing für Kink & BDSM Events – Privat & Sicher | Revel',
		description: 'Event-Management für Kink-, BDSM- und sex-positive Communities. Teilnehmer-Screening, Datenschutzkontrollen, Diskretion. Open-Source, selbst hostbar.',
		keywords: 'bdsm event ticketing, kink veranstaltung, sex positive events, fetisch party ticketing, adult event plattform'
	},
	hero: {
		headline: 'Diskretes Event-Management für Kink-Communities',
		subheadline: 'Teilnehmer-Screening, Datenschutzkontrollen und vollständige Datenhoheit. Entwickelt für Events, die Diskretion erfordern.'
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
			description: 'Fragebögen vor dem Ticketkauf erforderlich. Bewerbungen manuell prüfen, basierend auf Kriterien automatisch genehmigen oder Hybrid-Workflows nutzen.'
		},
		{
			icon: 'eye',
			title: 'Sichtbarkeitskontrollen',
			description: 'Öffentliche Listings, nur für Mitglieder oder komplett private Events nur auf Einladung. Du entscheidest, wer von deinen Events erfährt.'
		},
		{
			icon: 'lock',
			title: 'Vollständige Diskretion',
			description: 'Keine Plattform, die deine Teilnehmerliste leaken kann. Selbst hosten für maximale Privatsphäre oder unsere sicheren europäischen Server nutzen.'
		},
		{
			icon: 'shield',
			title: 'Kein Deplatforming-Risiko',
			description: 'Open Source und selbst hostbar. Keine Unternehmens-Inhaltsrichtlinien. Deine Events, deine Regeln.'
		},
		{
			icon: 'users',
			title: 'Community-Mitgliedschaft',
			description: 'Vertrauenswürdige Mitgliederlisten über Zeit aufbauen. Events auf geprüfte Community-Mitglieder beschränken.'
		},
		{
			icon: 'ticket',
			title: 'Vollständige Event-Funktionen',
			description: 'Mehrere Ticket-Stufen, QR-Check-in, Apple Wallet Passes, Sammelkäufe – alles was du für professionelle Events brauchst.'
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
			{ text: 'Selbst Hosten (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Kontakt', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Wie funktioniert das Teilnehmer-Screening?',
			answer: 'Du erstellst Fragebögen mit allen benötigten Fragen – Erfahrungslevel, Community-Referenzen, Konsens-Bestätigungen usw. Teilnehmer müssen den Fragebogen ausfüllen, bevor sie Tickets kaufen können. Du kannst Einreichungen manuell prüfen, Auto-Genehmigungs-Regeln setzen oder beide Ansätze kombinieren.'
		},
		{
			question: 'Kann ich meine Events komplett privat halten?',
			answer: 'Ja. Events können auf nur-auf-Einladung, nur für Mitglieder sichtbar oder komplett nicht gelistet eingestellt werden. Du kannst auch direkte Einladungen senden, die normale Anforderungen für vertrauenswürdige Gäste umgehen.'
		},
		{
			question: 'Was wenn ich maximale Privatsphäre brauche?',
			answer: 'Hoste Revel selbst auf deiner eigenen Infrastruktur. Deine Daten berühren niemals unsere Server. Die Software ist MIT-lizenziert und kostenlos nutzbar – du zahlst nur für dein eigenes Hosting und Stripe-Zahlungsabwicklung.'
		},
		{
			question: 'Besteht ein Risiko, dass meine Events zensiert werden?',
			answer: 'Nicht mit Revel. Wir sind Open Source ohne Inhaltsrichtlinien, die Adult-Events einschränken. Beim Selbst-Hosten hast du komplette Autonomie. Unsere gehostete Version läuft auf europäischer Infrastruktur und wir unterstützen explizit sex-positive Communities.'
		}
	],
	relatedPages: ['queer-event-management', 'privacy-focused-events', 'self-hosted-event-platform']
};

const selfHostedEventPlatformDE: LandingPageContent = {
	slug: 'self-hosted-event-platform',
	locale: 'de',
	meta: {
		title: 'Selbst Gehostetes Event-Management – Open Source & Kostenlos | Revel',
		description: 'MIT-lizenzierte Event-Plattform zum Betrieb auf eigenen Servern. Null Gebühren, volle Kontrolle, Docker-ready. Ticketing, RSVPs, Mitgliederverwaltung.',
		keywords: 'selbst gehostetes event management, open source ticketing, self hosted eventbrite, event management software, docker event plattform'
	},
	hero: {
		headline: 'Deine Events, Deine Server, Null Gebühren',
		subheadline: 'MIT-lizenziertes Event-Management zum überall Betreiben. Vollständiges Ticketing, RSVPs und Community-Tools – komplett unter deiner Kontrolle.'
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
			description: 'In Minuten mit Docker Compose starten. PostgreSQL, Redis, Celery – alles konfiguriert und einsatzbereit.'
		},
		{
			icon: 'euro',
			title: 'Null Plattformgebühren',
			description: 'Keine Pro-Ticket-Gebühren, keine monatlichen Kosten. Du zahlst nur für deine eigene Infrastruktur und Stripes Zahlungsabwicklung.'
		},
		{
			icon: 'code',
			title: 'MIT Lizenziert',
			description: 'Kommerziell nutzen, modifizieren, zurück beitragen – oder nicht. Keine Einschränkungen, keine Copyleft-Anforderungen.'
		},
		{
			icon: 'lock',
			title: 'Vollständige Datenkontrolle',
			description: 'Deine Daten verlassen niemals deine Server. Volle DSGVO-Konformität, weil du alles kontrollierst.'
		},
		{
			icon: 'ticket',
			title: 'Vollständiger Funktionsumfang',
			description: 'Ticketing, RSVPs, Organisationen, Mitgliedschaften, Fragebögen, QR-Check-in, Potluck-Koordination und mehr.'
		},
		{
			icon: 'globe',
			title: 'Moderne API',
			description: 'REST API mit OpenAPI-Dokumentation. Baue eigene Frontends, Integrationen oder Mobile Apps.'
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
			answer: 'Revel läuft überall wo Docker läuft. Minimum empfohlen: 2 CPU-Kerne, 4GB RAM, 20GB Speicher. Für Produktion mit vielen Events empfehlen wir 4+ Kerne und 8GB+ RAM. Du brauchst außerdem PostgreSQL (mit PostGIS), Redis und ein Stripe-Konto für Zahlungen.'
		},
		{
			question: 'Wie lange dauert das Deployment?',
			answer: 'Mit Docker Compose kannst du in unter 10 Minuten eine funktionierende Instanz haben. Das Repository enthält vollständige Deployment-Konfigurationen und Dokumentation.'
		},
		{
			question: 'Kann ich trotzdem Support bekommen beim Selbst-Hosten?',
			answer: 'Ja. Wir bieten Community-Support über GitHub Issues. Für Organisationen, die garantierte Reaktionszeiten oder individuelle Entwicklung brauchen, kontaktiere uns für professionelle Support-Optionen.'
		},
		{
			question: 'Was ist der Unterschied zwischen selbst gehostet und eurer gehosteten Version?',
			answer: 'Funktional identisch. Unsere gehostete Version bietet Komfort (wir verwalten Infrastruktur, Updates, Backups) im Austausch für eine kleine Pro-Ticket-Gebühr. Selbst gehostet ist kostenlos, aber du verwaltest alles selbst.'
		}
	],
	relatedPages: ['eventbrite-alternative', 'privacy-focused-events']
};

const privacyFocusedEventsDE: LandingPageContent = {
	slug: 'privacy-focused-events',
	locale: 'de',
	meta: {
		title: 'Datenschutzorientierte Event-Plattform – DSGVO-Konform | Revel',
		description: 'Event-Management, das Privatsphäre respektiert. Keine Datensammlung, keine Drittanbieter-Tracker. Europäisches Hosting, volle DSGVO-Konformität. Open Source.',
		keywords: 'dsgvo event plattform, datenschutz events, europäische event software, datenschutz veranstaltungen, private event verwaltung'
	},
	hero: {
		headline: 'Event-Management, Das Privatsphäre Respektiert',
		subheadline: 'Keine Datensammlung. Keine Drittanbieter-Tracker. Europäisches Hosting mit voller DSGVO-Konformität.'
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
			description: 'Kein Google Analytics, keine Facebook-Pixel, keine Werbe-SDKs. Wir tracken deine Teilnehmer nicht durchs Web.'
		},
		{
			icon: 'globe',
			title: 'Europäisches Hosting',
			description: 'Unsere gehostete Version läuft auf europäischer Infrastruktur und stellt sicher, dass deine Daten unter EU-Rechtsprechung und DSGVO-Schutz bleiben.'
		},
		{
			icon: 'lock',
			title: 'Datenminimierung',
			description: 'Wir sammeln nur was für Events nötig ist. Kein Profil-Building, keine Verhaltensanalyse, keine Datenmonetarisierung.'
		},
		{
			icon: 'server',
			title: 'Selbst-Hosting Option',
			description: 'Für maximale Kontrolle Revel auf eigener Infrastruktur betreiben. Deine Daten berühren niemals unsere Server.'
		},
		{
			icon: 'code',
			title: 'Transparenter Code',
			description: 'Open Source bedeutet, du kannst genau prüfen, wie deine Daten behandelt werden. Kein verstecktes Tracking, keine Überraschungen.'
		},
		{
			icon: 'check',
			title: 'DSGVO by Design',
			description: 'Datenexport, Löschanfragen, Einwilligungsverwaltung – Datenschutz-Compliance ist in die Plattform eingebaut.'
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
			{ text: 'Selbst Hosten (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Kontakt', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Wie ist Revel DSGVO-konform?',
			answer: 'Wir praktizieren Datenminimierung, bieten Datenexport- und Löschtools, holen ordnungsgemäße Einwilligung ein und hosten auf europäischer Infrastruktur. Als Open Source kannst du unsere Datenpraktiken direkt im Code prüfen.'
		},
		{
			question: 'Verkauft ihr Teilnehmerdaten?',
			answer: 'Nein. Wir haben kein Werbe-Geschäftsmodell. Unsere Einnahmen kommen von einer kleinen Pro-Ticket-Gebühr bei bezahlten Events (für gehostete Kunden). Wir haben keinen Anreiz, deine Daten zu monetarisieren.'
		},
		{
			question: 'Welche Daten sammelt ihr?',
			answer: 'Nur das Notwendige: Account-Informationen, Event-Details, Ticket-Käufe und Teilnehmerlisten. Wir tracken kein Browsing-Verhalten, erstellen keine Werbeprofile oder sammeln Daten über das hinaus, was du explizit angibst.'
		},
		{
			question: 'Kann ich komplette Datenkontrolle bekommen?',
			answer: 'Ja. Hoste Revel selbst auf eigener Infrastruktur und deine Daten berühren niemals unsere Server. Die Plattform ist MIT-lizenziert und kostenlos zu betreiben.'
		}
	],
	relatedPages: ['self-hosted-event-platform', 'queer-event-management']
};

// =============================================================================
// ITALIAN CONTENT
// =============================================================================

const eventbriteAlternativeIT: LandingPageContent = {
	slug: 'eventbrite-alternative',
	locale: 'it',
	meta: {
		title: 'Alternativa a Eventbrite – Commissioni Basse, Controllo Totale | Revel',
		description: 'Ticketing eventi open-source con solo 1,5% + 0,25€ per biglietto. Self-host gratis. I tuoi dati. Nessun lock-in. Hosting in Europa.',
		keywords: 'alternativa eventbrite, ticketing eventi economico, piattaforma eventi, software ticketing, gestione eventi'
	},
	hero: {
		headline: 'Smetti di Perdere Soldi in Commissioni',
		subheadline: 'Revel è l\'alternativa open-source a Eventbrite con prezzi trasparenti e proprietà totale dei dati.'
	},
	intro: {
		paragraphs: [
			'Stanco di Eventbrite che prende il 3,7% più commissioni da ogni biglietto venduto? Non sei solo. Gli organizzatori di eventi ovunque cercano alternative che non erodano i loro margini o li vincolino a una piattaforma incontrollabile.',
			'Revel è una piattaforma open-source per la gestione eventi con prezzi semplici e giusti: solo 1,5% + 0,25€ per biglietto a pagamento sulla nostra versione hosted—o completamente gratis se fai self-hosting. I ricavi dei tuoi biglietti vanno a te, non a una corporation.',
			'Sviluppato da organizzatori di community in Europa, Revel ti dà tutto il necessario: ticketing, RSVP, gestione partecipanti, strumenti di check-in e altro. Il tutto mantenendo i tuoi dati tuoi e i costi prevedibili.'
		]
	},
	features: [
		{
			icon: 'euro',
			title: 'Commissioni Trasparenti e Basse',
			description: 'Solo 1,5% + 0,25€ per biglietto a pagamento. Eventi gratuiti sempre gratis. Self-host e non paghi nulla.'
		},
		{
			icon: 'server',
			title: 'Opzione Self-Host',
			description: 'Installa Revel sulla tua infrastruttura con Docker. Zero commissioni piattaforma, controllo totale, licenza MIT.'
		},
		{
			icon: 'ticket',
			title: 'Suite Ticketing Completa',
			description: 'Più livelli di biglietti, acquisti multipli, check-in con QR code, integrazione Apple Wallet e pagamenti via Stripe.'
		},
		{
			icon: 'shield',
			title: 'I Tuoi Dati, Le Tue Regole',
			description: 'Nessun tracker di terze parti. Nessuna vendita dati. Piena conformità GDPR. Hosting su infrastruttura europea.'
		},
		{
			icon: 'users',
			title: 'Strumenti Community',
			description: 'Organizzazioni, membership, ruoli e permessi. Costruisci community durature, non solo eventi singoli.'
		},
		{
			icon: 'code',
			title: 'Open Source (MIT)',
			description: 'Codice completamente trasparente. Esaminalo, modificalo, contribuisci. Nessun vendor lock-in, mai.'
		}
	],
	benefits: {
		title: 'Perché gli Organizzatori Scelgono Revel',
		items: [
			'Tieni più ricavi dei biglietti con commissioni fino al 60% inferiori a Eventbrite',
			'Pagamenti Stripe diretti—niente attese per i versamenti della piattaforma',
			'Esporta i dati dei partecipanti quando vuoi, in formati standard',
			'Nessun rischio che cambiamenti di policy blocchino i tuoi eventi',
			'Hosting europeo con piena conformità GDPR',
			'Sviluppo attivo da una community che ascolta'
		]
	},
	cta: {
		title: 'Pronto a Cambiare?',
		description: 'Vedi Revel in azione o installalo tu stesso. Nessuna carta di credito richiesta.',
		buttons: [
			{ text: 'Prova la Demo', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Self-Host (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Contattaci', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Come si confrontano i prezzi di Revel con Eventbrite?',
			answer: 'Eventbrite addebita circa 3,7% + commissioni per biglietto, più elaborazione pagamenti. Revel addebita solo 1,5% + 0,25€ per biglietto a pagamento (più lo standard Stripe ~1,5% + 0,25€). Eventi gratuiti e deployment self-hosted hanno zero commissioni piattaforma.'
		},
		{
			question: 'Posso migrare i miei eventi da Eventbrite?',
			answer: 'Sì. Con Revel puoi ricreare facilmente i tuoi eventi con il nostro intuitivo builder. Puoi esportare le liste partecipanti da Eventbrite come CSV e usarle per invitare la tua community esistente ai tuoi nuovi eventi Revel.'
		},
		{
			question: 'Revel è davvero gratis per il self-hosting?',
			answer: 'Assolutamente. Revel è licenziato MIT, il che significa che puoi eseguirlo sui tuoi server senza pagarci nulla. Paghi solo la tua infrastruttura e le commissioni di elaborazione pagamenti di Stripe.'
		},
		{
			question: 'Dove è hostato Revel?',
			answer: 'La nostra versione hosted gira su infrastruttura europea, garantendo conformità GDPR e sovranità dei dati. Se fai self-host, scegli tu dove risiedono i tuoi dati.'
		}
	],
	relatedPages: ['self-hosted-event-platform', 'privacy-focused-events']
};

const queerEventManagementIT: LandingPageContent = {
	slug: 'queer-event-management',
	locale: 'it',
	meta: {
		title: 'Gestione Eventi per Community LGBTQ+ | Revel',
		description: 'Piattaforma eventi open-source creata da e per community queer. Controlli privacy, screening partecipanti, nessun rischio censura. Hosting in Europa.',
		keywords: 'piattaforma eventi lgbtq, gestione eventi queer, ticketing eventi gay, eventi pride, community queer'
	},
	hero: {
		headline: 'Software Eventi Che Capisce le Community Queer',
		subheadline: 'Creato da organizzatori LGBTQ+ per eventi che le piattaforme mainstream non sanno supportare.'
	},
	intro: {
		paragraphs: [
			'Le piattaforme eventi mainstream non sono state create pensando alle community queer. Policy sui contenuti vaghe che segnalano i tuoi eventi. Algoritmi che sopprimono la visibilità. Nessuna comprensione degli spazi sicuri o delle esigenze specifiche della community.',
			'Revel è diverso. Creato da organizzatori di eventi queer in Europa, è una piattaforma open-source progettata per community che hanno bisogno di più del semplice ticketing—hanno bisogno di fiducia, privacy e libertà di organizzare eventi senza paura di essere rimossi.',
			'Che tu stia organizzando feste Pride, meetup queer, drag show o ritrovi della community, Revel ti dà gli strumenti per costruire e proteggere la tua community. Gestione membri, screening partecipanti, controlli visibilità e proprietà completa dei dati—tutto in un\'unica piattaforma.'
		]
	},
	features: [
		{
			icon: 'heart',
			title: 'Costruito per la Community',
			description: 'Organizzazioni, membership e strumenti di community building. Crea spazi dove la tua community può prosperare oltre i singoli eventi.'
		},
		{
			icon: 'shield',
			title: 'Nessun Rischio Censura',
			description: 'Self-host o usa i nostri server europei. Nessuna policy aziendale che decide quali eventi puoi organizzare.'
		},
		{
			icon: 'clipboard',
			title: 'Screening Partecipanti',
			description: 'Questionari personalizzati per assicurare che i partecipanti siano in linea con i valori della community. Revisione manuale, auto-approvazione o workflow ibridi.'
		},
		{
			icon: 'eye',
			title: 'Controlli Privacy',
			description: 'Eventi pubblici, solo membri o solo su invito. Controlla chi vede cosa e mantieni private le liste partecipanti.'
		},
		{
			icon: 'lock',
			title: 'Sovranità dei Dati',
			description: 'I dati della tua community restano tuoi. Nessun tracker di terze parti, nessuna vendita dati, piena conformità GDPR.'
		},
		{
			icon: 'globe',
			title: 'Hosting Europeo',
			description: 'Hostato su infrastruttura europea con forti protezioni privacy. Self-host ovunque tu scelga.'
		}
	],
	benefits: {
		title: 'Perché gli Organizzatori LGBTQ+ Si Fidano di Revel',
		items: [
			'Nessun rischio che gli eventi vengano segnalati o rimossi per policy della piattaforma',
			'Screening partecipanti per mantenere spazi più sicuri',
			'Costruisci membership durature, non solo liste evento per evento',
			'Controllo totale sui dati della tua community',
			'Creato da persone che capiscono l\'organizzazione eventi queer',
			'Open source e trasparente—vedi esattamente come funziona'
		]
	},
	cta: {
		title: 'La Tua Community Merita Strumenti Migliori',
		description: 'Scopri come funziona Revel o inizia a costruire la tua community oggi.',
		buttons: [
			{ text: 'Prova la Demo', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Self-Host (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Contattaci', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Cosa rende Revel diverso da Eventbrite o Meetup?',
			answer: 'Revel è stato costruito specificamente per community che necessitano di privacy, screening e libertà dalla censura delle piattaforme. Non abbiamo policy sui contenuti che limitano eventi adult o queer, e ti diamo il controllo totale sui tuoi dati.'
		},
		{
			question: 'Posso controllare chi partecipa ai miei eventi?',
			answer: 'Sì. Revel include un potente sistema di questionari che ti permette di richiedere ai partecipanti di rispondere a domande prima di acquistare biglietti o fare RSVP. Puoi revisionare le risposte manualmente, impostare regole di auto-approvazione o usare un approccio ibrido.'
		},
		{
			question: 'I dati della mia community sono al sicuro?',
			answer: 'Assolutamente. Non vendiamo dati né usiamo tracker di terze parti. La nostra versione hosted gira su server europei con conformità GDPR. Se fai self-host, hai il controllo completo su dove risiedono i tuoi dati.'
		},
		{
			question: 'Posso organizzare eventi solo per membri?',
			answer: 'Sì. Puoi creare organizzazioni con livelli di membership e limitare gli eventi ai soli membri, a livelli specifici di membership, o renderli pubblici. Controlli la visibilità a ogni livello.'
		}
	],
	relatedPages: ['kink-event-ticketing', 'privacy-focused-events']
};

const kinkEventTicketingIT: LandingPageContent = {
	slug: 'kink-event-ticketing',
	locale: 'it',
	meta: {
		title: 'Ticketing per Eventi Kink & BDSM – Privato & Sicuro | Revel',
		description: 'Gestione eventi per community kink, BDSM e sex-positive. Screening partecipanti, controlli privacy, discrezione. Open-source, self-hostable.',
		keywords: 'ticketing eventi bdsm, gestione eventi kink, eventi sex positive, ticketing feste fetish, piattaforma eventi adult'
	},
	hero: {
		headline: 'Gestione Eventi Discreta per Community Kink',
		subheadline: 'Screening partecipanti, controlli privacy e proprietà completa dei dati. Costruito per eventi che richiedono discrezione.'
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
			description: 'Richiedi questionari prima dell\'acquisto biglietti. Revisiona le candidature manualmente, approva automaticamente in base a criteri o usa workflow ibridi.'
		},
		{
			icon: 'eye',
			title: 'Controlli Visibilità',
			description: 'Listing pubblici, solo membri o eventi privati solo su invito. Tu decidi chi sa dei tuoi eventi.'
		},
		{
			icon: 'lock',
			title: 'Discrezione Completa',
			description: 'Nessuna piattaforma che possa far trapelare la tua lista partecipanti. Self-host per massima privacy o usa i nostri server europei sicuri.'
		},
		{
			icon: 'shield',
			title: 'Nessun Rischio Deplatforming',
			description: 'Open source e self-hostable. Nessuna policy aziendale sui contenuti. I tuoi eventi, le tue regole.'
		},
		{
			icon: 'users',
			title: 'Membership Community',
			description: 'Costruisci liste membri fidati nel tempo. Limita gli eventi ai membri verificati della community.'
		},
		{
			icon: 'ticket',
			title: 'Funzionalità Eventi Complete',
			description: 'Più livelli biglietti, check-in QR, pass Apple Wallet, acquisti multipli—tutto il necessario per eventi professionali.'
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
			'Creato da persone che capiscono l\'organizzazione eventi kink'
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
			answer: 'Crei questionari con tutte le domande necessarie—livello esperienza, referenze community, conferme consenso, ecc. I partecipanti devono completare il questionario prima di poter acquistare biglietti. Puoi revisionare le risposte manualmente, impostare regole auto-approvazione o combinare entrambi gli approcci.'
		},
		{
			question: 'Posso mantenere i miei eventi completamente privati?',
			answer: 'Sì. Gli eventi possono essere impostati come solo su invito, visibili solo ai membri, o completamente non listati. Puoi anche inviare inviti diretti che bypassano i requisiti normali per ospiti fidati.'
		},
		{
			question: 'E se ho bisogno di massima privacy?',
			answer: 'Fai self-host di Revel sulla tua infrastruttura. I tuoi dati non toccano mai i nostri server. Il software è licenziato MIT e gratuito da usare—paghi solo il tuo hosting e l\'elaborazione pagamenti Stripe.'
		},
		{
			question: 'C\'è rischio che i miei eventi vengano censurati?',
			answer: 'Non con Revel. Siamo open source senza policy sui contenuti che limitano eventi adult. Se fai self-host, hai completa autonomia. La nostra versione hosted gira su infrastruttura europea e supportiamo esplicitamente le community sex-positive.'
		}
	],
	relatedPages: ['queer-event-management', 'privacy-focused-events', 'self-hosted-event-platform']
};

const selfHostedEventPlatformIT: LandingPageContent = {
	slug: 'self-hosted-event-platform',
	locale: 'it',
	meta: {
		title: 'Gestione Eventi Self-Hosted – Open Source & Gratis | Revel',
		description: 'Piattaforma eventi MIT che puoi installare sui tuoi server. Zero commissioni, controllo totale, Docker-ready. Ticketing, RSVP, gestione membri.',
		keywords: 'gestione eventi self hosted, ticketing open source, self hosted eventbrite, software gestione eventi, piattaforma eventi docker'
	},
	hero: {
		headline: 'I Tuoi Eventi, I Tuoi Server, Zero Commissioni',
		subheadline: 'Gestione eventi MIT che puoi installare ovunque. Ticketing completo, RSVP e strumenti community—completamente sotto il tuo controllo.'
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
			description: 'Parti in minuti con Docker Compose. PostgreSQL, Redis, Celery—tutto configurato e pronto.'
		},
		{
			icon: 'euro',
			title: 'Zero Commissioni Piattaforma',
			description: 'Nessuna commissione per biglietto, nessun costo mensile. Paghi solo la tua infrastruttura e l\'elaborazione pagamenti di Stripe.'
		},
		{
			icon: 'code',
			title: 'Licenza MIT',
			description: 'Usalo commercialmente, modificalo, contribuisci—o no. Nessuna restrizione, nessun requisito copyleft.'
		},
		{
			icon: 'lock',
			title: 'Controllo Dati Completo',
			description: 'I tuoi dati non lasciano mai i tuoi server. Piena conformità GDPR perché controlli tutto.'
		},
		{
			icon: 'ticket',
			title: 'Set Funzionalità Completo',
			description: 'Ticketing, RSVP, organizzazioni, membership, questionari, check-in QR, coordinamento potluck e altro.'
		},
		{
			icon: 'globe',
			title: 'API Moderna',
			description: 'REST API con documentazione OpenAPI. Costruisci frontend personalizzati, integrazioni o app mobile.'
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
			answer: 'Revel gira ovunque giri Docker. Minimo raccomandato: 2 core CPU, 4GB RAM, 20GB storage. Per produzione con molti eventi, raccomandiamo 4+ core e 8GB+ RAM. Serviranno anche PostgreSQL (con PostGIS), Redis e un account Stripe per i pagamenti.'
		},
		{
			question: 'Quanto tempo richiede il deployment?',
			answer: 'Con Docker Compose puoi avere un\'istanza funzionante in meno di 10 minuti. Il repository include configurazioni di deployment complete e documentazione.'
		},
		{
			question: 'Posso comunque avere supporto se faccio self-host?',
			answer: 'Sì. Offriamo supporto community tramite GitHub issues. Per organizzazioni che necessitano tempi di risposta garantiti o sviluppo personalizzato, contattaci per opzioni di supporto professionale.'
		},
		{
			question: 'Qual è la differenza tra self-hosted e la vostra versione hosted?',
			answer: 'Funzionalmente identiche. La nostra versione hosted aggiunge comodità (gestiamo infrastruttura, aggiornamenti, backup) in cambio di una piccola commissione per biglietto. Self-hosted è gratis ma gestisci tutto tu.'
		}
	],
	relatedPages: ['eventbrite-alternative', 'privacy-focused-events']
};

const privacyFocusedEventsIT: LandingPageContent = {
	slug: 'privacy-focused-events',
	locale: 'it',
	meta: {
		title: 'Piattaforma Eventi Privacy-First – Conforme GDPR | Revel',
		description: 'Gestione eventi che rispetta la privacy. Nessuna raccolta dati, nessun tracker terze parti. Hosting europeo, piena conformità GDPR. Open source.',
		keywords: 'piattaforma eventi gdpr, eventi privacy, software eventi europeo, protezione dati eventi, gestione eventi privati'
	},
	hero: {
		headline: 'Gestione Eventi Che Rispetta la Privacy',
		subheadline: 'Nessuna raccolta dati. Nessun tracker terze parti. Hosting europeo con piena conformità GDPR.'
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
			description: 'Niente Google Analytics, niente pixel Facebook, niente SDK pubblicitari. Non tracciamo i tuoi partecipanti sul web.'
		},
		{
			icon: 'globe',
			title: 'Hosting Europeo',
			description: 'La nostra versione hosted gira su infrastruttura europea, assicurando che i tuoi dati restino sotto giurisdizione UE e protezione GDPR.'
		},
		{
			icon: 'lock',
			title: 'Minimizzazione Dati',
			description: 'Raccogliamo solo il necessario per gestire eventi. Nessun profiling, nessuna analisi comportamentale, nessuna monetizzazione dati.'
		},
		{
			icon: 'server',
			title: 'Opzione Self-Host',
			description: 'Per massimo controllo, installa Revel sulla tua infrastruttura. I tuoi dati non toccano mai i nostri server.'
		},
		{
			icon: 'code',
			title: 'Codice Trasparente',
			description: 'Open source significa che puoi verificare esattamente come vengono gestiti i tuoi dati. Nessun tracking nascosto, nessuna sorpresa.'
		},
		{
			icon: 'check',
			title: 'GDPR by Design',
			description: 'Export dati, richieste cancellazione, gestione consenso—la conformità privacy è integrata nella piattaforma.'
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
			answer: 'Pratichiamo minimizzazione dati, forniamo strumenti di export e cancellazione dati, otteniamo consenso appropriato e hostiamo su infrastruttura europea. Come open source, puoi verificare le nostre pratiche dati direttamente nel codice.'
		},
		{
			question: 'Vendete i dati dei partecipanti?',
			answer: 'No. Non abbiamo un modello di business pubblicitario. I nostri ricavi vengono da una piccola commissione per biglietto su eventi a pagamento (per clienti hosted). Non abbiamo incentivo a monetizzare i tuoi dati.'
		},
		{
			question: 'Quali dati raccogliete?',
			answer: 'Solo il necessario: informazioni account, dettagli eventi, acquisti biglietti e liste partecipanti. Non tracciamo comportamento di navigazione, non costruiamo profili pubblicitari, non raccogliamo dati oltre quello che fornisci esplicitamente.'
		},
		{
			question: 'Posso avere controllo completo sui dati?',
			answer: 'Sì. Fai self-host di Revel sulla tua infrastruttura e i tuoi dati non toccano mai i nostri server. La piattaforma è licenziata MIT e gratuita da installare.'
		}
	],
	relatedPages: ['self-hosted-event-platform', 'queer-event-management']
};

// =============================================================================
// EXPORTS
// =============================================================================

export const landingPages: Record<string, Record<string, LandingPageContent>> = {
	en: {
		'eventbrite-alternative': eventbriteAlternativeEN,
		'queer-event-management': queerEventManagementEN,
		'kink-event-ticketing': kinkEventTicketingEN,
		'self-hosted-event-platform': selfHostedEventPlatformEN,
		'privacy-focused-events': privacyFocusedEventsEN
	},
	de: {
		'eventbrite-alternative': eventbriteAlternativeDE,
		'queer-event-management': queerEventManagementDE,
		'kink-event-ticketing': kinkEventTicketingDE,
		'self-hosted-event-platform': selfHostedEventPlatformDE,
		'privacy-focused-events': privacyFocusedEventsDE
	},
	it: {
		'eventbrite-alternative': eventbriteAlternativeIT,
		'queer-event-management': queerEventManagementIT,
		'kink-event-ticketing': kinkEventTicketingIT,
		'self-hosted-event-platform': selfHostedEventPlatformIT,
		'privacy-focused-events': privacyFocusedEventsIT
	}
};

export const landingPageSlugs: LandingPageSlug[] = [
	'eventbrite-alternative',
	'queer-event-management',
	'kink-event-ticketing',
	'self-hosted-event-platform',
	'privacy-focused-events'
];

export function getLandingPage(locale: string, slug: string): LandingPageContent | undefined {
	return landingPages[locale]?.[slug];
}

export function getAllLandingPages(): LandingPageContent[] {
	return Object.values(landingPages).flatMap((locale) => Object.values(locale));
}
