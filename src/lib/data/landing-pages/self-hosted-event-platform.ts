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

export const selfHostedEventPlatformES: LandingPageContent = {
	slug: 'self-hosted-event-platform',
	locale: 'es',
	meta: {
		title: 'Gestión de Eventos Autoalojada – Código Abierto y Gratis | Revel',
		description:
			'Plataforma de eventos con licencia MIT que puedes instalar en tus propios servidores. Cero comisiones, control total, lista para Docker. Entradas, RSVP, gestión de socios.',
		keywords:
			'gestión de eventos open source, alternativa a eventbrite, software de entradas gratis, plataforma de eventos autoalojada, docker eventos'
	},
	hero: {
		headline: 'Tus Eventos, Tus Servidores, Cero Comisiones',
		subheadline:
			'Gestión de eventos con licencia MIT que puedes instalar donde quieras. Entradas completas, RSVP y herramientas de comunidad, completamente bajo tu control.'
	},
	intro: {
		paragraphs: [
			'¿Por qué pagar cuotas mensuales de SaaS y confiar los datos de tu comunidad a una corporación? Revel es un software de gestión de eventos de código abierto que puedes instalar en tu propia infraestructura en minutos.',
			'Construido con tecnologías modernas (Django, PostgreSQL, Redis y Docker), Revel está listo para producción y probado en el mundo real. Entradas completas con integración de Stripe, RSVP, gestión de socios, selección de participantes, check-in por QR y mucho más. Todas las funciones de las plataformas comerciales, sin costes recurrentes ni preocupaciones sobre los datos.',
			'Licencia MIT significa que puedes usarlo, modificarlo e instalarlo como quieras. Sin dependencia de proveedor. Sin cambios de precio sorpresa. Ninguna plataforma decide qué eventos puedes organizar. Tu infraestructura, tus reglas.'
		]
	},
	features: [
		{
			icon: 'server',
			title: 'Despliegue Listo para Docker',
			description:
				'Ponlo en marcha en minutos con Docker Compose. PostgreSQL, Redis, Celery: todo configurado y listo.'
		},
		{
			icon: 'euro',
			title: 'Cero Comisiones de Plataforma',
			description:
				'Sin comisiones por entrada, sin costes mensuales. Solo pagas tu propia infraestructura y el procesamiento de pagos de Stripe.'
		},
		{
			icon: 'code',
			title: 'Licencia MIT',
			description:
				'Úsalo comercialmente, modifícalo, contribuye de vuelta... o no. Sin restricciones, sin obligaciones copyleft.'
		},
		{
			icon: 'lock',
			title: 'Control Total de los Datos',
			description:
				'Tus datos nunca salen de tus servidores. Cumplimiento total del RGPD porque tú lo controlas todo.'
		},
		{
			icon: 'ticket',
			title: 'Todas las Funciones Incluidas',
			description:
				'Entradas, RSVP, organizaciones, membresías, cuestionarios, check-in por QR, coordinación de comidas compartidas y mucho más.'
		},
		{
			icon: 'globe',
			title: 'API Moderna',
			description:
				'API REST con documentación OpenAPI. Crea tus propios frontends, integraciones o apps móviles.'
		}
	],
	benefits: {
		title: 'Por Qué Autoalojar Revel',
		items: [
			'Elimina los costes recurrentes de SaaS: paga solo tu infraestructura',
			'Soberanía y privacidad total de los datos',
			'Sin riesgo de cambios de política o subidas de precio de la plataforma',
			'Personaliza y amplía el código según tus necesidades',
			'Instala en cualquier región para cumplir con la normativa de datos',
			'Comunidad y desarrollo activos'
		]
	},
	cta: {
		title: 'En Marcha en Minutos',
		description: 'Consulta el código, lee la documentación o prueba primero la demo alojada.',
		buttons: [
			{ text: 'Ver en GitHub', href: 'https://github.com/letsrevel', variant: 'primary' },
			{ text: 'Probar la Demo', href: 'https://demo.letsrevel.io', variant: 'secondary' },
			{ text: 'Contáctanos', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: '¿Cuáles son los requisitos del sistema?',
			answer:
				'Revel funciona en cualquier sitio donde funcione Docker. Mínimo recomendado: 2 núcleos de CPU, 4GB de RAM, 20GB de almacenamiento. Para producción con muchos eventos, recomendamos 4+ núcleos y 8GB+ de RAM. También necesitarás PostgreSQL (con PostGIS), Redis y una cuenta de Stripe para los pagos.'
		},
		{
			question: '¿Cuánto tarda el despliegue?',
			answer:
				'Con Docker Compose puedes tener una instancia funcionando en menos de 10 minutos. El repositorio incluye configuraciones de despliegue completas y documentación.'
		},
		{
			question: '¿Puedo seguir teniendo soporte si me autoalojo?',
			answer:
				'Sí. Ofrecemos soporte comunitario a través de GitHub issues. Para organizaciones que necesiten tiempos de respuesta garantizados o desarrollo a medida, contáctanos para conocer las opciones de soporte profesional.'
		},
		{
			question: '¿Cuál es la diferencia entre autoalojado y vuestra versión alojada?',
			answer:
				'Funcionalmente idénticas. Nuestra versión alojada añade comodidad (gestionamos infraestructura, actualizaciones, copias de seguridad) a cambio de una pequeña comisión por entrada. Autoalojado es gratis, pero gestionas todo tú.'
		}
	],
	relatedPages: ['eventbrite-alternative', 'privacy-focused-events']
};

export const selfHostedEventPlatformPT: LandingPageContent = {
	slug: 'self-hosted-event-platform',
	locale: 'pt',
	meta: {
		title: 'Gestão de Eventos Autoalojada – Código Aberto e Gratuita | Revel',
		description:
			'Plataforma de eventos com licença MIT que podes instalar nos teus próprios servidores. Zero comissões, controlo total, pronta para Docker. Bilhetes, RSVP, gestão de membros.',
		keywords:
			'gestão de eventos open source, alternativa ao eventbrite, software de bilhetes gratuito, plataforma de eventos autoalojada, docker eventos'
	},
	hero: {
		headline: 'Os Teus Eventos, os Teus Servidores, Zero Comissões',
		subheadline:
			'Gestão de eventos com licença MIT que podes instalar em qualquer lugar. Bilhética completa, RSVP e ferramentas de comunidade — totalmente sob o teu controlo.'
	},
	intro: {
		paragraphs: [
			'Porquê pagar mensalidades de SaaS e confiar os dados da tua comunidade a uma corporação? O Revel é um software de gestão de eventos de código aberto que podes instalar na tua própria infraestrutura em minutos.',
			'Construído com tecnologias modernas — Django, PostgreSQL, Redis e Docker — o Revel está pronto para produção e testado em condições reais. Bilhética completa com integração Stripe, RSVP, gestão de membros, seleção de participantes, check-in por QR e muito mais. Todas as funcionalidades das plataformas comerciais, sem custos recorrentes nem preocupações com os dados.',
			'Licença MIT significa que podes usá-lo, modificá-lo e instalá-lo como quiseres. Sem dependência de fornecedor. Sem alterações de preço surpresa. Nenhuma plataforma decide que eventos podes organizar. A tua infraestrutura, as tuas regras.'
		]
	},
	features: [
		{
			icon: 'server',
			title: 'Implementação Pronta para Docker',
			description:
				'Fica operacional em minutos com o Docker Compose. PostgreSQL, Redis, Celery — tudo configurado e pronto a usar.'
		},
		{
			icon: 'euro',
			title: 'Zero Comissões de Plataforma',
			description:
				'Sem comissões por bilhete, sem custos mensais. Só pagas a tua própria infraestrutura e o processamento de pagamentos do Stripe.'
		},
		{
			icon: 'code',
			title: 'Licença MIT',
			description:
				'Usa-o comercialmente, modifica-o, contribui de volta — ou não. Sem restrições, sem obrigações copyleft.'
		},
		{
			icon: 'lock',
			title: 'Controlo Total dos Dados',
			description:
				'Os teus dados nunca saem dos teus servidores. Conformidade total com o RGPD porque controlas tudo.'
		},
		{
			icon: 'ticket',
			title: 'Conjunto Completo de Funcionalidades',
			description:
				'Bilhética, RSVP, organizações, associações, questionários, check-in por QR, coordenação de refeições partilhadas e muito mais.'
		},
		{
			icon: 'globe',
			title: 'API Moderna',
			description:
				'API REST com documentação OpenAPI. Cria os teus próprios frontends, integrações ou aplicações móveis.'
		}
	],
	benefits: {
		title: 'Porquê Autoalojar o Revel',
		items: [
			'Elimina os custos recorrentes de SaaS — paga apenas a tua infraestrutura',
			'Soberania e privacidade total dos dados',
			'Sem risco de alterações de política ou aumentos de preço da plataforma',
			'Personaliza e estende o código conforme as tuas necessidades',
			'Instala em qualquer região para conformidade de dados',
			'Comunidade e desenvolvimento ativos'
		]
	},
	cta: {
		title: 'Operacional em Minutos',
		description: 'Consulta o código, lê a documentação ou experimenta primeiro a demo alojada.',
		buttons: [
			{ text: 'Ver no GitHub', href: 'https://github.com/letsrevel', variant: 'primary' },
			{ text: 'Experimentar a Demo', href: 'https://demo.letsrevel.io', variant: 'secondary' },
			{ text: 'Contacta-nos', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Quais são os requisitos do sistema?',
			answer:
				'O Revel funciona em qualquer lugar onde o Docker funcione. Mínimo recomendado: 2 núcleos de CPU, 4GB de RAM, 20GB de armazenamento. Para produção com muitos eventos, recomendamos 4+ núcleos e 8GB+ de RAM. Também vais precisar de PostgreSQL (com PostGIS), Redis e uma conta Stripe para os pagamentos.'
		},
		{
			question: 'Quanto tempo demora a implementação?',
			answer:
				'Com o Docker Compose, podes ter uma instância a funcionar em menos de 10 minutos. O repositório inclui configurações de implementação completas e documentação.'
		},
		{
			question: 'Posso continuar a ter suporte se me autoalojar?',
			answer:
				'Sim. Oferecemos suporte da comunidade através de issues no GitHub. Para organizações que precisem de tempos de resposta garantidos ou desenvolvimento personalizado, contacta-nos sobre as opções de suporte profissional.'
		},
		{
			question: 'Qual é a diferença entre autoalojado e a vossa versão alojada?',
			answer:
				'Funcionalmente idênticas. A nossa versão alojada acrescenta comodidade (gerimos a infraestrutura, atualizações, cópias de segurança) em troca de uma pequena comissão por bilhete. Autoalojado é gratuito, mas geres tudo tu.'
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
