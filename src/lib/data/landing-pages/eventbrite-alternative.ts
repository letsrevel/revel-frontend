import type { LandingPageContent } from './types';

export const eventbriteAlternativeEN: LandingPageContent = {
	slug: 'eventbrite-alternative',
	locale: 'en',
	meta: {
		title: 'Eventbrite Alternative – Lower Fees, Full Control | Revel',
		description:
			'Open-source event ticketing with just 1.5% + €0.25 per ticket. Self-host for zero fees. Own your data. No platform lock-in. Hosted in Europe.',
		keywords:
			'eventbrite alternative, cheap event ticketing, low fee ticketing, event platform, ticketing software'
	},
	hero: {
		headline: 'Stop Losing Money to Platform Fees',
		subheadline:
			'Revel is the open-source Eventbrite alternative with transparent pricing and full data ownership.'
	},
	intro: {
		paragraphs: [
			"Tired of Eventbrite taking 3.7% plus fees from every ticket sold? You're not alone. Event organizers everywhere are looking for alternatives that don't eat into their margins or lock them into a platform they can't control.",
			'Revel is an open-source event management platform with simple, fair pricing: just 1.5% + €0.25 per paid ticket on our hosted version—or completely free if you self-host. Your ticket revenue goes to you, not to a corporation.',
			'Built by community organizers in Europe, Revel gives you everything you need: ticketing, RSVPs, attendee management, check-in tools, and more. All while keeping your data yours and your costs predictable.'
		]
	},
	features: [
		{
			icon: 'euro',
			title: 'Transparent, Low Fees',
			description:
				'Just 1.5% + €0.25 per paid ticket. Free events are always free. Self-host and pay nothing at all.'
		},
		{
			icon: 'server',
			title: 'Self-Host Option',
			description:
				'Deploy Revel on your own infrastructure with Docker. Zero platform fees, complete control, MIT licensed.'
		},
		{
			icon: 'ticket',
			title: 'Full Ticketing Suite',
			description:
				'Multiple ticket tiers, batch purchases, QR code check-in, Apple Wallet integration, and Stripe-powered payments.'
		},
		{
			icon: 'shield',
			title: 'Your Data, Your Rules',
			description:
				'No third-party trackers. No data selling. Full GDPR compliance. Hosted on European infrastructure.'
		},
		{
			icon: 'users',
			title: 'Community Tools',
			description:
				'Organizations, memberships, roles and permissions. Build lasting communities, not just one-off events.'
		},
		{
			icon: 'code',
			title: 'Open Source (MIT)',
			description:
				'Fully transparent codebase. Audit it, modify it, contribute to it. No vendor lock-in, ever.'
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
			answer:
				"Eventbrite charges around 3.7% + fees per ticket, plus payment processing. Revel charges just 1.5% + €0.25 per paid ticket (plus Stripe's standard ~1.5% + €0.25). Free events and self-hosted deployments have zero platform fees."
		},
		{
			question: 'Can I migrate my events from Eventbrite?',
			answer:
				'Yes. Revel makes it easy to recreate your events with our intuitive event builder. You can export your attendee lists from Eventbrite as CSV and use them to invite your existing community to your new Revel events.'
		},
		{
			question: 'Is Revel really free to self-host?',
			answer:
				"Absolutely. Revel is MIT licensed, which means you can run it on your own servers without paying us anything. You only pay for your own infrastructure and Stripe's payment processing fees."
		},
		{
			question: 'Where is Revel hosted?',
			answer:
				'Our hosted version runs on European infrastructure, ensuring GDPR compliance and data sovereignty. If you self-host, you choose where your data lives.'
		}
	],
	relatedPages: ['self-hosted-event-platform', 'privacy-focused-events']
};

export const eventbriteAlternativeDE: LandingPageContent = {
	slug: 'eventbrite-alternative',
	locale: 'de',
	meta: {
		title: 'Eventbrite-Alternative – Niedrige Gebühren, Volle Kontrolle | Revel',
		description:
			'Open-Source Event-Ticketing mit nur 1,5% + 0,25€ pro Ticket. Selbst hosten für null Gebühren. Eigene Daten. Kein Plattform-Lock-in. Gehostet in Europa.',
		keywords:
			'eventbrite alternative, günstige ticketing plattform, event software, ticketing system, veranstaltungsmanagement'
	},
	hero: {
		headline: 'Schluss mit hohen Plattformgebühren',
		subheadline:
			'Revel ist die Open-Source Eventbrite-Alternative mit transparenten Preisen und voller Datenkontrolle.'
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
			description:
				'Nur 1,5% + 0,25€ pro bezahltem Ticket. Kostenlose Events sind immer kostenlos. Selbst hosten und gar nichts zahlen.'
		},
		{
			icon: 'server',
			title: 'Selbst-Hosting Option',
			description:
				'Revel mit Docker auf eigener Infrastruktur betreiben. Null Plattformgebühren, volle Kontrolle, MIT-lizenziert.'
		},
		{
			icon: 'ticket',
			title: 'Vollständige Ticketing-Suite',
			description:
				'Mehrere Ticket-Stufen, Sammelkäufe, QR-Code Check-in, Apple Wallet Integration und Stripe-basierte Zahlungen.'
		},
		{
			icon: 'shield',
			title: 'Deine Daten, Deine Regeln',
			description:
				'Keine Drittanbieter-Tracker. Kein Datenverkauf. Volle DSGVO-Konformität. Auf europäischer Infrastruktur gehostet.'
		},
		{
			icon: 'users',
			title: 'Community-Tools',
			description:
				'Organisationen, Mitgliedschaften, Rollen und Berechtigungen. Baue nachhaltige Communities, nicht nur einzelne Events.'
		},
		{
			icon: 'code',
			title: 'Open Source (MIT)',
			description:
				'Vollständig transparenter Code. Prüfe ihn, modifiziere ihn, trage bei. Kein Vendor Lock-in, niemals.'
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
			question: 'Wie vergleichen sich Revels Preise mit Eventbrite?',
			answer:
				'Eventbrite berechnet etwa 3,7% + Gebühren pro Ticket, plus Zahlungsabwicklung. Revel berechnet nur 1,5% + 0,25€ pro bezahltem Ticket (plus Stripes Standard ~1,5% + 0,25€). Kostenlose Events und selbst gehostete Deployments haben null Plattformgebühren.'
		},
		{
			question: 'Kann ich meine Events von Eventbrite migrieren?',
			answer:
				'Ja. Mit Revel kannst du deine Events ganz einfach mit unserem intuitiven Event-Builder neu erstellen. Du kannst deine Teilnehmerlisten von Eventbrite als CSV exportieren und sie nutzen, um deine bestehende Community zu deinen neuen Revel-Events einzuladen.'
		},
		{
			question: 'Ist Revel wirklich kostenlos zum Selbst-Hosten?',
			answer:
				'Absolut. Revel ist MIT-lizenziert, was bedeutet, dass du es auf eigenen Servern betreiben kannst, ohne uns etwas zu zahlen. Du zahlst nur für deine eigene Infrastruktur und Stripes Zahlungsgebühren.'
		},
		{
			question: 'Wo wird Revel gehostet?',
			answer:
				'Unsere gehostete Version läuft auf europäischer Infrastruktur und gewährleistet DSGVO-Konformität und Datensouveränität. Beim Selbst-Hosting entscheidest du, wo deine Daten liegen.'
		}
	],
	relatedPages: ['self-hosted-event-platform', 'privacy-focused-events']
};

export const eventbriteAlternativeIT: LandingPageContent = {
	slug: 'eventbrite-alternative',
	locale: 'it',
	meta: {
		title: 'Alternativa a Eventbrite – Commissioni Basse, Controllo Totale | Revel',
		description:
			'Ticketing eventi open-source con solo 1,5% + 0,25€ per biglietto. Self-host gratis. I tuoi dati. Nessun lock-in. Hosting in Europa.',
		keywords:
			'alternativa eventbrite, ticketing eventi economico, piattaforma eventi, software ticketing, gestione eventi'
	},
	hero: {
		headline: 'Smetti di Perdere Soldi in Commissioni',
		subheadline:
			"Revel è l'alternativa open-source a Eventbrite con prezzi trasparenti e proprietà totale dei dati."
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
			description:
				'Solo 1,5% + 0,25€ per biglietto a pagamento. Eventi gratuiti sempre gratis. Self-host e non paghi nulla.'
		},
		{
			icon: 'server',
			title: 'Opzione Self-Host',
			description:
				'Installa Revel sulla tua infrastruttura con Docker. Zero commissioni piattaforma, controllo totale, licenza MIT.'
		},
		{
			icon: 'ticket',
			title: 'Suite Ticketing Completa',
			description:
				'Più livelli di biglietti, acquisti multipli, check-in con QR code, integrazione Apple Wallet e pagamenti via Stripe.'
		},
		{
			icon: 'shield',
			title: 'I Tuoi Dati, Le Tue Regole',
			description:
				'Nessun tracker di terze parti. Nessuna vendita dati. Piena conformità GDPR. Hosting su infrastruttura europea.'
		},
		{
			icon: 'users',
			title: 'Strumenti Community',
			description:
				'Organizzazioni, membership, ruoli e permessi. Costruisci community durature, non solo eventi singoli.'
		},
		{
			icon: 'code',
			title: 'Open Source (MIT)',
			description:
				'Codice completamente trasparente. Esaminalo, modificalo, contribuisci. Nessun vendor lock-in, mai.'
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
			answer:
				'Eventbrite addebita circa 3,7% + commissioni per biglietto, più elaborazione pagamenti. Revel addebita solo 1,5% + 0,25€ per biglietto a pagamento (più lo standard Stripe ~1,5% + 0,25€). Eventi gratuiti e deployment self-hosted hanno zero commissioni piattaforma.'
		},
		{
			question: 'Posso migrare i miei eventi da Eventbrite?',
			answer:
				'Sì. Con Revel puoi ricreare facilmente i tuoi eventi con il nostro intuitivo builder. Puoi esportare le liste partecipanti da Eventbrite come CSV e usarle per invitare la tua community esistente ai tuoi nuovi eventi Revel.'
		},
		{
			question: 'Revel è davvero gratis per il self-hosting?',
			answer:
				'Assolutamente. Revel è licenziato MIT, il che significa che puoi eseguirlo sui tuoi server senza pagarci nulla. Paghi solo la tua infrastruttura e le commissioni di elaborazione pagamenti di Stripe.'
		},
		{
			question: 'Dove è hostato Revel?',
			answer:
				'La nostra versione hosted gira su infrastruttura europea, garantendo conformità GDPR e sovranità dei dati. Se fai self-host, scegli tu dove risiedono i tuoi dati.'
		}
	],
	relatedPages: ['self-hosted-event-platform', 'privacy-focused-events']
};

export const eventbriteAlternativeFR: LandingPageContent = {
	slug: 'eventbrite-alternative',
	locale: 'fr',
	meta: {
		title: 'Alternative à Eventbrite – Frais réduits, contrôle total | Revel',
		description:
			'Billetterie événementielle open source à seulement 1,5 % + 0,25 € par billet. Auto-hébergement sans aucuns frais. Tes données t’appartiennent. Aucun verrouillage de plateforme. Hébergé en Europe.',
		keywords:
			'alternative eventbrite, plateforme de billetterie pas chère, logiciel événementiel, système de billetterie, gestion d’événements'
	},
	hero: {
		headline: 'Fini les frais de plateforme exorbitants',
		subheadline:
			'Revel est l’alternative open source à Eventbrite, avec une tarification transparente et un contrôle total sur tes données.'
	},
	intro: {
		paragraphs: [
			'Frustré·e par Eventbrite, qui prélève 3,7 % plus des frais sur chaque billet vendu ? Tu n’es pas seul·e. Partout, les organisateurs cherchent des alternatives qui ne grignotent pas leurs marges et ne les enferment pas dans une plateforme incontrôlable.',
			'Revel est une plateforme open source de gestion d’événements avec une tarification simple et équitable : seulement 1,5 % + 0,25 € par billet payant sur notre version hébergée – ou totalement gratuite en auto-hébergement. Tes recettes de billetterie t’appartiennent, pas à un grand groupe.',
			'Conçue par des organisateurs de communautés en Europe, Revel offre tout ce dont tu as besoin : billetterie, RSVP, gestion des participants, outils de check-in et bien plus. Le tout en gardant tes données et des coûts prévisibles.'
		]
	},
	features: [
		{
			icon: 'euro',
			title: 'Frais transparents et réduits',
			description:
				'Seulement 1,5 % + 0,25 € par billet payant. Les événements gratuits restent toujours gratuits. Auto-héberge et ne paie rien du tout.'
		},
		{
			icon: 'server',
			title: 'Option d’auto-hébergement',
			description:
				'Fais tourner Revel avec Docker sur ta propre infrastructure. Aucuns frais de plateforme, contrôle total, sous licence MIT.'
		},
		{
			icon: 'ticket',
			title: 'Suite de billetterie complète',
			description:
				'Plusieurs catégories de billets, achats groupés, check-in par QR code, intégration Apple Wallet et paiements via Stripe.'
		},
		{
			icon: 'shield',
			title: 'Tes données, tes règles',
			description:
				'Aucun traqueur tiers. Aucune revente de données. Conformité totale au RGPD. Hébergé sur une infrastructure européenne.'
		},
		{
			icon: 'users',
			title: 'Outils communautaires',
			description:
				'Organisations, adhésions, rôles et permissions. Construis des communautés durables, pas seulement des événements isolés.'
		},
		{
			icon: 'code',
			title: 'Open source (MIT)',
			description:
				'Un code entièrement transparent. Inspecte-le, modifie-le, contribue. Aucun verrouillage fournisseur, jamais.'
		}
	],
	benefits: {
		title: 'Pourquoi les organisateurs choisissent Revel',
		items: [
			'Garde une plus grande part de tes recettes de billetterie avec des frais jusqu’à 60 % inférieurs à ceux d’Eventbrite',
			'Versements Stripe directs – plus besoin d’attendre les paiements de la plateforme',
			'Exporte les données de tes participants à tout moment dans des formats standards',
			'Aucun risque que des changements de règles de la plateforme paralysent tes événements',
			'Hébergement européen avec conformité totale au RGPD',
			'Un développement actif mené par une communauté à l’écoute'
		]
	},
	cta: {
		title: 'Prêt·e à changer ?',
		description: 'Découvre Revel en action ou héberge-le toi-même. Aucune carte bancaire requise.',
		buttons: [
			{ text: 'Tester la démo en direct', href: 'https://demo.letsrevel.io', variant: 'primary' },
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
			question: 'Comment les tarifs de Revel se comparent-ils à ceux d’Eventbrite ?',
			answer:
				'Eventbrite facture environ 3,7 % + des frais par billet, plus le traitement des paiements. Revel ne facture que 1,5 % + 0,25 € par billet payant (plus le standard Stripe d’environ 1,5 % + 0,25 €). Les événements gratuits et les déploiements auto-hébergés n’ont aucuns frais de plateforme.'
		},
		{
			question: 'Puis-je migrer mes événements depuis Eventbrite ?',
			answer:
				'Oui. Avec Revel, tu peux facilement recréer tes événements grâce à notre éditeur d’événements intuitif. Tu peux exporter tes listes de participants depuis Eventbrite au format CSV et les utiliser pour inviter ta communauté existante à tes nouveaux événements Revel.'
		},
		{
			question: 'Revel est-il vraiment gratuit en auto-hébergement ?',
			answer:
				'Absolument. Revel est sous licence MIT, ce qui signifie que tu peux le faire tourner sur tes propres serveurs sans nous payer quoi que ce soit. Tu ne paies que ta propre infrastructure et les frais de paiement de Stripe.'
		},
		{
			question: 'Où Revel est-il hébergé ?',
			answer:
				'Notre version hébergée fonctionne sur une infrastructure européenne, garantissant la conformité au RGPD et la souveraineté des données. En auto-hébergement, c’est toi qui décides où se trouvent tes données.'
		}
	],
	relatedPages: ['self-hosted-event-platform', 'privacy-focused-events']
};
