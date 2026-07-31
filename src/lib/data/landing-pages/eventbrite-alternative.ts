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

export const eventbriteAlternativeES: LandingPageContent = {
	slug: 'eventbrite-alternative',
	locale: 'es',
	meta: {
		title: 'Alternativa a Eventbrite – Comisiones bajas, control total | Revel',
		description:
			'Ticketing de eventos de código abierto con solo 1,5 % + 0,25 € por entrada. Auto-alójalo gratis. Tus datos son tuyos. Sin dependencia de plataforma. Alojado en Europa.',
		keywords:
			'alternativa a eventbrite, venta de entradas online barata, plataforma de eventos, software de ticketing, gestión de eventos'
	},
	hero: {
		headline: 'Deja de perder dinero en comisiones de plataforma',
		subheadline:
			'Revel es la alternativa de código abierto a Eventbrite, con precios transparentes y control total de tus datos.'
	},
	intro: {
		paragraphs: [
			'¿Te cansa que Eventbrite se lleve un 3,7 % más comisiones de cada entrada vendida? No es un caso aislado: en todas partes, quienes organizan eventos buscan alternativas que no reduzcan sus márgenes ni les encierren en una plataforma que no pueden controlar.',
			'Revel es una plataforma de gestión de eventos de código abierto con precios simples y justos: solo 1,5 % + 0,25 € por entrada de pago en nuestra versión alojada, o completamente gratis si te lo auto-alojas. Los ingresos de tus entradas son para ti, no para una corporación.',
			'Creada por personas organizadoras de comunidades en Europa, Revel te da todo lo que necesitas: venta de entradas, confirmaciones de asistencia, gestión de participantes, herramientas de acceso y mucho más. Todo ello manteniendo tus datos bajo tu control y tus costes predecibles.'
		]
	},
	features: [
		{
			icon: 'euro',
			title: 'Comisiones bajas y transparentes',
			description:
				'Solo 1,5 % + 0,25 € por entrada de pago. Los eventos gratuitos siempre son gratis. Auto-alójalo y no pagues nada en absoluto.'
		},
		{
			icon: 'server',
			title: 'Opción de auto-alojamiento',
			description:
				'Despliega Revel en tu propia infraestructura con Docker. Cero comisiones de plataforma, control total, licencia MIT.'
		},
		{
			icon: 'ticket',
			title: 'Suite de ticketing completa',
			description:
				'Varias categorías de entradas, compras por lotes, acceso con código QR, integración con Apple Wallet y pagos con Stripe.'
		},
		{
			icon: 'shield',
			title: 'Tus datos, tus reglas',
			description:
				'Sin rastreadores de terceros. Sin venta de datos. Cumplimiento total del RGPD. Alojado en infraestructura europea.'
		},
		{
			icon: 'users',
			title: 'Herramientas para comunidades',
			description:
				'Organizaciones, membresías, roles y permisos. Construye comunidades duraderas, no solo eventos puntuales.'
		},
		{
			icon: 'code',
			title: 'Código abierto (MIT)',
			description:
				'Código completamente transparente. Audítalo, modifícalo, contribuye. Sin dependencia de proveedor, nunca.'
		}
	],
	benefits: {
		title: 'Por qué quienes organizan eligen Revel',
		items: [
			'Conserva más ingresos de tus entradas con comisiones hasta un 60 % más bajas que Eventbrite',
			'Pagos directos vía Stripe, sin esperar a los desembolsos de la plataforma',
			'Exporta los datos de las personas participantes cuando quieras, en formatos estándar',
			'Sin riesgo de que un cambio de políticas de la plataforma paralice tus eventos',
			'Alojamiento europeo con cumplimiento total del RGPD',
			'Desarrollo activo por parte de una comunidad que escucha'
		]
	},
	cta: {
		title: '¿Hora de cambiar?',
		description:
			'Descubre Revel en acción o despliégalo por tu cuenta. No hace falta tarjeta de crédito.',
		buttons: [
			{ text: 'Probar la demo en vivo', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Auto-alojar (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Contáctanos', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: '¿Cómo se comparan los precios de Revel con los de Eventbrite?',
			answer:
				'Eventbrite cobra alrededor de un 3,7 % + comisiones por entrada, más el procesamiento de pagos. Revel cobra solo 1,5 % + 0,25 € por entrada de pago (más el estándar de Stripe de aproximadamente 1,5 % + 0,25 €). Los eventos gratuitos y los despliegues auto-alojados no tienen comisiones de plataforma.'
		},
		{
			question: '¿Puedo migrar mis eventos desde Eventbrite?',
			answer:
				'Sí. Revel facilita recrear tus eventos con nuestro intuitivo creador de eventos. Puedes exportar tus listas de participantes de Eventbrite como CSV y usarlas para invitar a tu comunidad existente a tus nuevos eventos en Revel.'
		},
		{
			question: '¿Es Revel realmente gratis para auto-alojar?',
			answer:
				'Por supuesto. Revel tiene licencia MIT, lo que significa que puedes ejecutarlo en tus propios servidores sin pagarnos nada. Solo pagas tu propia infraestructura y las comisiones de procesamiento de pagos de Stripe.'
		},
		{
			question: '¿Dónde está alojado Revel?',
			answer:
				'Nuestra versión alojada funciona sobre infraestructura europea, lo que garantiza el cumplimiento del RGPD y la soberanía de los datos. Si te auto-alojas, tú decides dónde viven tus datos.'
		}
	],
	relatedPages: ['self-hosted-event-platform', 'privacy-focused-events']
};

export const eventbriteAlternativePT: LandingPageContent = {
	slug: 'eventbrite-alternative',
	locale: 'pt',
	meta: {
		title: 'Alternativa ao Eventbrite – Taxas reduzidas, controlo total | Revel',
		description:
			'Bilhética de eventos open-source com apenas 1,5 % + 0,25 € por bilhete. Auto-hospeda gratuitamente. Os teus dados são teus. Sem dependência de plataforma. Alojado na Europa.',
		keywords:
			'alternativa ao eventbrite, venda de bilhetes online barata, plataforma de eventos, software de bilhética, gestão de eventos'
	},
	hero: {
		headline: 'Para de perder dinheiro em taxas de plataforma',
		subheadline:
			'A Revel é a alternativa open-source ao Eventbrite, com preços transparentes e controlo total dos teus dados.'
	},
	intro: {
		paragraphs: [
			'Custa-te ver o Eventbrite a ficar com 3,7 % mais taxas em cada bilhete vendido? Não é um caso isolado: por todo o lado, quem organiza eventos procura alternativas que não corroam as suas margens nem prendam ninguém a uma plataforma incontrolável.',
			'A Revel é uma plataforma open-source de gestão de eventos com preços simples e justos: apenas 1,5 % + 0,25 € por bilhete pago na nossa versão alojada – ou totalmente gratuita se optares por auto-hospedar. As receitas dos teus bilhetes são para ti, não para uma corporação.',
			'Criada por pessoas que organizam comunidades na Europa, a Revel dá-te tudo o que precisas: bilhética, confirmações de presença, gestão de participantes, ferramentas de check-in e muito mais. Tudo isto mantendo os teus dados sob o teu controlo e os custos previsíveis.'
		]
	},
	features: [
		{
			icon: 'euro',
			title: 'Taxas baixas e transparentes',
			description:
				'Apenas 1,5 % + 0,25 € por bilhete pago. Os eventos gratuitos são sempre gratuitos. Auto-hospeda e não pagues nada.'
		},
		{
			icon: 'server',
			title: 'Opção de auto-hospedagem',
			description:
				'Instala a Revel na tua própria infraestrutura com Docker. Zero taxas de plataforma, controlo total, licença MIT.'
		},
		{
			icon: 'ticket',
			title: 'Suite de bilhética completa',
			description:
				'Vários tipos de bilhete, compras em lote, check-in por código QR, integração com a Apple Wallet e pagamentos via Stripe.'
		},
		{
			icon: 'shield',
			title: 'Os teus dados, as tuas regras',
			description:
				'Sem rastreadores de terceiros. Sem venda de dados. Total conformidade com o RGPD. Alojado em infraestrutura europeia.'
		},
		{
			icon: 'users',
			title: 'Ferramentas para comunidades',
			description:
				'Organizações, associações, funções e permissões. Constrói comunidades duradouras, não apenas eventos pontuais.'
		},
		{
			icon: 'code',
			title: 'Código aberto (MIT)',
			description:
				'Código totalmente transparente. Audita-o, modifica-o, contribui. Sem dependência de fornecedor, nunca.'
		}
	],
	benefits: {
		title: 'Porque é que quem organiza escolhe a Revel',
		items: [
			'Fica com mais receitas dos teus bilhetes, com taxas até 60 % mais baixas do que o Eventbrite',
			'Pagamentos diretos via Stripe – sem esperar pelos desembolsos da plataforma',
			'Exporta os dados dos participantes quando quiseres, em formatos padrão',
			'Sem risco de mudanças nas políticas da plataforma paralisarem os teus eventos',
			'Alojamento europeu com total conformidade com o RGPD',
			'Desenvolvimento ativo por uma comunidade que ouve'
		]
	},
	cta: {
		title: 'Hora de mudar?',
		description:
			'Descobre a Revel em ação ou aloja-a por tua conta. Não é preciso cartão de crédito.',
		buttons: [
			{
				text: 'Experimentar a demo ao vivo',
				href: 'https://demo.letsrevel.io',
				variant: 'primary'
			},
			{
				text: 'Auto-hospedar (GitHub)',
				href: 'https://github.com/letsrevel',
				variant: 'secondary'
			},
			{ text: 'Contacta-nos', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Como é que os preços da Revel se comparam aos do Eventbrite?',
			answer:
				'O Eventbrite cobra cerca de 3,7 % + taxas por bilhete, mais o processamento de pagamentos. A Revel cobra apenas 1,5 % + 0,25 € por bilhete pago (mais o padrão da Stripe de cerca de 1,5 % + 0,25 €). Eventos gratuitos e implementações auto-hospedadas não têm taxas de plataforma.'
		},
		{
			question: 'Posso migrar os meus eventos do Eventbrite?',
			answer:
				'Sim. A Revel facilita a recriação dos teus eventos com o nosso criador de eventos intuitivo. Podes exportar as tuas listas de participantes do Eventbrite em CSV e usá-las para convidar a tua comunidade existente para os teus novos eventos na Revel.'
		},
		{
			question: 'A Revel é mesmo gratuita para auto-hospedar?',
			answer:
				'Sem dúvida. A Revel tem licença MIT, o que significa que podes executá-la nos teus próprios servidores sem nos pagar nada. Só pagas a tua própria infraestrutura e as taxas de processamento de pagamentos da Stripe.'
		},
		{
			question: 'Onde é que a Revel está alojada?',
			answer:
				'A nossa versão alojada funciona em infraestrutura europeia, garantindo conformidade com o RGPD e soberania de dados. Se optares por auto-hospedar, és tu que decides onde ficam os teus dados.'
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
