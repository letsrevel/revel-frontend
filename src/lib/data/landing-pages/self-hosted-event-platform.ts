import type { LandingPageContent } from './types';

export const selfHostedEventPlatformEN: LandingPageContent = {
	slug: 'self-hosted-event-platform',
	locale: 'en',
	meta: {
		title: 'Self-Hosted Event Management, Open Source and Free | Revel',
		description:
			'Run Revel on your own server under the MIT license. Ticketing, RSVPs, memberships, screening questionnaires and QR check-in with no platform fee. Docker Compose setup.',
		keywords:
			'self hosted event management, open source ticketing, self hosted eventbrite, event management software, docker event platform'
	},
	hero: {
		headline: 'Your Events, Your Server, No Platform Fee',
		subheadline:
			'Revel is MIT-licensed event software you can run yourself. The same code as our hosted version, on hardware you control.'
	},
	intro: {
		paragraphs: [
			"Some organizers want their community's data on a machine they control. Others just don't want to hand over a cut of every ticket. Either way, Revel is open source and you can run it yourself.",
			'The whole stack ships as Docker Compose: Django, PostgreSQL with PostGIS, Redis, Celery, and Caddy taking care of HTTPS. A setup script walks you through the configuration, and a small server with 2 vCPUs and 4 GB of RAM is enough to get going.',
			"Everything beyond the core is optional. Plug in Stripe when you want to sell tickets online, SMTP for email, Apple and Google Wallet credentials for passes, an OpenID Connect provider for single sign-on, or Telegram for notifications. Leave out what you don't need."
		]
	},
	features: [
		{
			icon: 'server',
			title: 'Docker Compose Setup',
			description:
				'One compose file for the whole stack and a setup wizard that asks the right questions. You need a Linux server, two hostnames and ports 80 and 443.'
		},
		{
			icon: 'euro',
			title: 'No Platform Fee',
			description:
				"Our 1.5% + €0.25 only applies on the hosted version. On your own server you pay for hosting and, if you sell online, Stripe's processing fee."
		},
		{
			icon: 'code',
			title: 'MIT Licensed',
			description:
				'Use it commercially, fork it, change it. The backend, the frontend and the deployment setup are all public.'
		},
		{
			icon: 'lock',
			title: 'Your Data Stays Home',
			description:
				'Attendee lists, questionnaire answers and payment records live in your own database. You decide where it runs and who can reach it.'
		},
		{
			icon: 'ticket',
			title: 'The Full Feature Set',
			description:
				'Ticketing with reserved seating, RSVPs, memberships, series passes, screening questionnaires, potluck boards and QR check-in.'
		},
		{
			icon: 'globe',
			title: 'Documented REST API',
			description:
				'OpenAPI docs come built in, so you can script against your instance or build your own tools on top.'
		}
	],
	benefits: {
		title: 'Why Run It Yourself',
		items: [
			'No fee to us on any ticket or transaction',
			'Pick the country and the provider your data lives with',
			'Optional services stay off until you configure them',
			'Change the code to fit how your community works',
			'Single sign-on with Google or any OpenID Connect provider, such as Keycloak',
			'Issues and development happen in the open on GitHub'
		]
	},
	cta: {
		title: 'Spin Up Your Own Instance',
		description: 'Grab the code and the deployment guide, or look around the hosted demo first.',
		buttons: [
			{ text: 'View on GitHub', href: 'https://github.com/letsrevel', variant: 'primary' },
			{ text: 'Try the Demo', href: 'https://demo.letsrevel.io', variant: 'secondary' },
			{ text: 'Contact Us', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'What do I need to run Revel?',
			answer:
				'A Linux x86-64 server, a domain with two hostnames pointing at it, and ports 80 and 443 open. The slim setup runs on 2 vCPUs and 4 GB of RAM, which costs around €20 a month at most hosting providers. Larger communities can move up to the full setup.'
		},
		{
			question: 'Do I need a Stripe account?',
			answer:
				'Only if you want to take payments online. Free events, RSVPs, and tickets paid offline or at the door all work without it.'
		},
		{
			question: 'How is it different from your hosted version?',
			answer:
				"It's the same code. On the hosted version we run the servers, the updates and the backups, and take 1.5% + €0.25 on online payments. When you self-host, all of that is yours to handle, including setting up optional services like email, wallet passes or the Eventbrite integration with your own credentials."
		},
		{
			question: 'Which languages does it support?',
			answer:
				'The interface comes in English, German, Italian, French, Spanish and Portuguese, and each person picks their own.'
		},
		{
			question: 'Can I get help if I self-host?',
			answer:
				"Open an issue on GitHub and we'll take a look. If you need something more hands-on, get in touch and we'll talk it through."
		}
	],
	relatedPages: ['eventbrite-alternative', 'privacy-focused-events']
};

export const selfHostedEventPlatformDE: LandingPageContent = {
	slug: 'self-hosted-event-platform',
	locale: 'de',
	meta: {
		title: 'Event-Management selbst hosten: Open Source und kostenlos | Revel',
		description:
			'Betreibe Revel unter MIT-Lizenz auf deinem eigenen Server. Ticketing, RSVPs, Mitgliedschaften, Screening-Fragebögen und QR-Check-in ohne Plattformgebühr. Setup mit Docker Compose.',
		keywords:
			'event management selbst hosten, open source ticketing, event software selbst gehostet, self hosted eventbrite, eventbrite alternative, veranstaltungssoftware docker'
	},
	hero: {
		headline: 'Deine Events, dein Server, keine Plattformgebühr',
		subheadline:
			'Revel ist MIT-lizenzierte Event-Software, die du selbst betreiben kannst. Derselbe Code wie in unserer gehosteten Version, auf Hardware, die du kontrollierst.'
	},
	intro: {
		paragraphs: [
			'Manche Veranstalter*innen wollen die Daten ihrer Community auf einem Rechner haben, den sie selbst kontrollieren. Andere wollen einfach nicht bei jedem Ticket einen Anteil abgeben. So oder so: Revel ist Open Source, und du kannst es selbst betreiben.',
			'Der komplette Stack kommt als Docker Compose: Django, PostgreSQL mit PostGIS, Redis, Celery und Caddy, das sich um HTTPS kümmert. Ein Setup-Skript führt dich durch die Konfiguration, und für den Anfang reicht ein kleiner Server mit 2 vCPUs und 4 GB RAM.',
			'Alles jenseits des Kerns ist optional. Binde Stripe ein, wenn du Tickets online verkaufen willst, SMTP für E-Mails, Zugangsdaten für Apple und Google Wallet für Wallet-Pässe, einen OpenID-Connect-Anbieter für Single Sign-on oder Telegram für Benachrichtigungen. Was du nicht brauchst, lässt du einfach weg.'
		]
	},
	features: [
		{
			icon: 'server',
			title: 'Setup mit Docker Compose',
			description:
				'Eine Compose-Datei für den ganzen Stack und ein Einrichtungsassistent, der die richtigen Fragen stellt. Du brauchst einen Linux-Server, zwei Hostnamen und die Ports 80 und 443.'
		},
		{
			icon: 'euro',
			title: 'Keine Plattformgebühr',
			description:
				'Unsere 1,5% + 0,25€ fallen nur in der gehosteten Version an. Auf deinem eigenen Server zahlst du fürs Hosting und, wenn du online verkaufst, die Transaktionsgebühr von Stripe.'
		},
		{
			icon: 'code',
			title: 'MIT-Lizenz',
			description:
				'Nutze es kommerziell, forke es, verändere es. Backend, Frontend und das Deployment-Setup sind alle öffentlich.'
		},
		{
			icon: 'lock',
			title: 'Deine Daten bleiben zu Hause',
			description:
				'Teilnehmer*innenlisten, Antworten auf Fragebögen und Zahlungsdaten liegen in deiner eigenen Datenbank. Du entscheidest, wo sie läuft und wer darauf zugreifen kann.'
		},
		{
			icon: 'ticket',
			title: 'Der volle Funktionsumfang',
			description:
				'Ticketing mit Sitzplatzreservierung, RSVPs, Mitgliedschaften, Serien-Pässe, Screening-Fragebögen, Potluck-Listen und QR-Check-in.'
		},
		{
			icon: 'globe',
			title: 'Dokumentierte REST-API',
			description:
				'Die OpenAPI-Doku ist direkt eingebaut. So kannst du deine Instanz per Skript steuern oder eigene Tools darauf aufbauen.'
		}
	],
	benefits: {
		title: 'Warum selbst betreiben',
		items: [
			'Keine Gebühr an uns, bei keinem Ticket und keiner Transaktion',
			'Du wählst das Land und den Anbieter, bei dem deine Daten liegen',
			'Optionale Dienste bleiben aus, bis du sie konfigurierst',
			'Passe den Code an die Arbeitsweise deiner Community an',
			'Single Sign-on mit Google oder jedem OpenID-Connect-Anbieter, zum Beispiel Keycloak',
			'Issues und Entwicklung laufen öffentlich auf GitHub'
		]
	},
	cta: {
		title: 'Starte deine eigene Instanz',
		description:
			'Hol dir den Code und die Deployment-Anleitung oder schau dich zuerst in der gehosteten Demo um.',
		buttons: [
			{ text: 'Auf GitHub ansehen', href: 'https://github.com/letsrevel', variant: 'primary' },
			{ text: 'Demo ausprobieren', href: 'https://demo.letsrevel.io', variant: 'secondary' },
			{ text: 'Kontakt aufnehmen', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Was brauche ich, um Revel zu betreiben?',
			answer:
				'Einen Linux-Server (x86-64), eine Domain mit zwei Hostnamen, die darauf zeigen, und offene Ports 80 und 443. Das schlanke Setup läuft mit 2 vCPUs und 4 GB RAM, das kostet bei den meisten Hostern rund 20 € im Monat. Größere Communitys können auf das volle Setup umsteigen.'
		},
		{
			question: 'Brauche ich ein Stripe-Konto?',
			answer:
				'Nur wenn du Zahlungen online annehmen willst. Kostenlose Events, RSVPs und Tickets, die offline oder am Einlass bezahlt werden, funktionieren alle ohne.'
		},
		{
			question: 'Was ist anders als bei eurer gehosteten Version?',
			answer:
				'Es ist derselbe Code. In der gehosteten Version kümmern wir uns um Server, Updates und Backups und nehmen 1,5% + 0,25€ auf Online-Zahlungen. Wenn du selbst hostest, liegt all das bei dir, auch die Einrichtung optionaler Dienste wie E-Mail, Wallet-Pässe oder die Eventbrite-Integration mit deinen eigenen Zugangsdaten.'
		},
		{
			question: 'Welche Sprachen werden unterstützt?',
			answer:
				'Die Oberfläche gibt es auf Englisch, Deutsch, Italienisch, Französisch, Spanisch und Portugiesisch, und jede Person wählt ihre eigene.'
		},
		{
			question: 'Bekomme ich Hilfe, wenn ich selbst hoste?',
			answer:
				'Eröffne ein Issue auf GitHub, und wir schauen es uns an. Wenn du mehr direkte Unterstützung brauchst, melde dich bei uns, dann besprechen wir das.'
		}
	],
	relatedPages: ['eventbrite-alternative', 'privacy-focused-events']
};

export const selfHostedEventPlatformES: LandingPageContent = {
	slug: 'self-hosted-event-platform',
	locale: 'es',
	meta: {
		title: 'Gestión de eventos autoalojada, de código abierto y gratis | Revel',
		description:
			'Instala Revel en tu propio servidor con licencia MIT. Venta de entradas, RSVP, membresías, cuestionarios de selección y check-in con QR sin comisión de plataforma. Instalación con Docker Compose.',
		keywords:
			'gestión de eventos autoalojada, software de eventos open source, venta de entradas open source, alternativa a eventbrite, self hosted eventbrite, plataforma de eventos docker'
	},
	hero: {
		headline: 'Tus eventos, tu servidor, sin comisión de plataforma',
		subheadline:
			'Revel es un software de eventos con licencia MIT que puedes instalar por tu cuenta. El mismo código que nuestra versión alojada, en un hardware que controlas tú.'
	},
	intro: {
		paragraphs: [
			'Hay quienes organizan eventos y quieren los datos de su comunidad en una máquina que controlan. Otras personas simplemente no quieren ceder una parte de cada entrada. En cualquier caso, Revel es de código abierto y puedes instalarlo por tu cuenta.',
			'Todo el stack viene como Docker Compose: Django, PostgreSQL con PostGIS, Redis, Celery y Caddy, que se encarga del HTTPS. Un script de instalación te guía por la configuración, y para empezar basta con un servidor pequeño de 2 vCPU y 4 GB de RAM.',
			'Todo lo que va más allá del núcleo es opcional. Conecta Stripe cuando quieras vender entradas online, SMTP para el correo, credenciales de Apple Wallet y Google Wallet para los pases, un proveedor de OpenID Connect para el inicio de sesión único o Telegram para las notificaciones. Lo que no necesites, déjalo fuera.'
		]
	},
	features: [
		{
			icon: 'server',
			title: 'Instalación con Docker Compose',
			description:
				'Un solo archivo compose para todo el stack y un asistente de configuración que hace las preguntas adecuadas. Necesitas un servidor Linux, dos nombres de host y los puertos 80 y 443.'
		},
		{
			icon: 'euro',
			title: 'Sin comisión de plataforma',
			description:
				'Nuestro 1,5 % + 0,25 € solo se aplica en la versión alojada. En tu propio servidor pagas el alojamiento y, si vendes online, la comisión de procesamiento de Stripe.'
		},
		{
			icon: 'code',
			title: 'Licencia MIT',
			description:
				'Úsalo con fines comerciales, haz un fork, modifícalo. El backend, el frontend y la configuración de despliegue son públicos.'
		},
		{
			icon: 'lock',
			title: 'Tus datos se quedan en casa',
			description:
				'Las listas de asistentes, las respuestas a los cuestionarios y los registros de pago se guardan en tu propia base de datos. Tú decides dónde se ejecuta y quién puede acceder.'
		},
		{
			icon: 'ticket',
			title: 'Todas las funciones',
			description:
				'Venta de entradas con asientos numerados, RSVP, membresías, pases de serie, cuestionarios de selección, tablones de aportaciones y check-in con QR.'
		},
		{
			icon: 'globe',
			title: 'API REST documentada',
			description:
				'La documentación OpenAPI viene integrada, así que puedes automatizar tu instancia con scripts o crear tus propias herramientas encima.'
		}
	],
	benefits: {
		title: 'Por qué instalarlo por tu cuenta',
		items: [
			'Ninguna comisión para nosotros en ninguna entrada ni transacción',
			'Elige el país y el proveedor donde viven tus datos',
			'Los servicios opcionales quedan desactivados hasta que los configures',
			'Adapta el código a cómo funciona tu comunidad',
			'Inicio de sesión único con Google o cualquier proveedor de OpenID Connect, como Keycloak',
			'Las incidencias y el desarrollo se llevan en abierto en GitHub'
		]
	},
	cta: {
		title: 'Monta tu propia instancia',
		description:
			'Descarga el código y la guía de despliegue, o echa antes un vistazo a la demo alojada.',
		buttons: [
			{ text: 'Ver en GitHub', href: 'https://github.com/letsrevel', variant: 'primary' },
			{ text: 'Probar la demo', href: 'https://demo.letsrevel.io', variant: 'secondary' },
			{ text: 'Contáctanos', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: '¿Qué necesito para ejecutar Revel?',
			answer:
				'Un servidor Linux x86-64, un dominio con dos nombres de host que apunten a él y los puertos 80 y 443 abiertos. La configuración ligera funciona con 2 vCPU y 4 GB de RAM, lo que cuesta unos 20 € al mes en la mayoría de proveedores de hosting. Las comunidades más grandes pueden pasar a la configuración completa.'
		},
		{
			question: '¿Necesito una cuenta de Stripe?',
			answer:
				'Solo si quieres cobrar pagos online. Los eventos gratuitos, los RSVP y las entradas pagadas fuera de línea o en la puerta funcionan sin ella.'
		},
		{
			question: '¿En qué se diferencia de vuestra versión alojada?',
			answer:
				'Es el mismo código. En la versión alojada nos encargamos de los servidores, las actualizaciones y las copias de seguridad, y cobramos 1,5 % + 0,25 € por los pagos online. Si lo alojas por tu cuenta, todo eso queda en tus manos, incluida la configuración de servicios opcionales como el correo, los pases para wallet o la integración con Eventbrite con tus propias credenciales.'
		},
		{
			question: '¿Qué idiomas admite?',
			answer:
				'La interfaz está disponible en inglés, alemán, italiano, francés, español y portugués, y cada persona elige el suyo.'
		},
		{
			question: '¿Puedo recibir ayuda si lo alojo por mi cuenta?',
			answer:
				'Abre una incidencia en GitHub y le echamos un vistazo. Si necesitas un acompañamiento más cercano, escríbenos y lo hablamos.'
		}
	],
	relatedPages: ['eventbrite-alternative', 'privacy-focused-events']
};

export const selfHostedEventPlatformPT: LandingPageContent = {
	slug: 'self-hosted-event-platform',
	locale: 'pt',
	meta: {
		title: 'Gestão de eventos autoalojada, open source e gratuita | Revel',
		description:
			'Instala o Revel no teu próprio servidor com licença MIT. Bilhética, RSVP, adesões, questionários de seleção e check-in por QR sem comissão de plataforma. Instalação com Docker Compose.',
		keywords:
			'gestão de eventos autoalojada, software de eventos open source, bilhética open source, alternativa ao eventbrite, self hosted eventbrite, plataforma de eventos docker'
	},
	hero: {
		headline: 'Os teus eventos, o teu servidor, sem comissão de plataforma',
		subheadline:
			'O Revel é um software de eventos com licença MIT que podes instalar por conta própria. O mesmo código da nossa versão alojada, em hardware que controlas.'
	},
	intro: {
		paragraphs: [
			'Há quem organize eventos e queira os dados da sua comunidade numa máquina que controla. Outras pessoas simplesmente não querem ceder uma fatia de cada bilhete. Seja como for, o Revel é open source e podes instalá-lo por conta própria.',
			'Todo o stack vem em Docker Compose: Django, PostgreSQL com PostGIS, Redis, Celery e o Caddy, que trata do HTTPS. Um script de instalação guia-te pela configuração, e para começar basta um servidor pequeno com 2 vCPU e 4 GB de RAM.',
			'Tudo o que vai além do núcleo é opcional. Liga o Stripe quando quiseres vender bilhetes online, SMTP para o email, credenciais do Apple Wallet e do Google Wallet para os passes, um fornecedor OpenID Connect para o início de sessão único ou o Telegram para as notificações. O que não precisares, deixa de fora.'
		]
	},
	features: [
		{
			icon: 'server',
			title: 'Instalação com Docker Compose',
			description:
				'Um único ficheiro compose para todo o stack e um assistente de configuração que faz as perguntas certas. Precisas de um servidor Linux, dois nomes de host e as portas 80 e 443.'
		},
		{
			icon: 'euro',
			title: 'Sem comissão de plataforma',
			description:
				'A nossa comissão de 1,5 % + 0,25 € só se aplica na versão alojada. No teu próprio servidor pagas o alojamento e, se venderes online, a taxa de processamento do Stripe.'
		},
		{
			icon: 'code',
			title: 'Licença MIT',
			description:
				'Usa-o comercialmente, faz um fork, altera-o. O backend, o frontend e a configuração de implementação são todos públicos.'
		},
		{
			icon: 'lock',
			title: 'Os teus dados ficam em casa',
			description:
				'Listas de participantes, respostas aos questionários e registos de pagamento ficam na tua própria base de dados. Tu decides onde ela corre e quem lhe pode aceder.'
		},
		{
			icon: 'ticket',
			title: 'Todas as funcionalidades',
			description:
				'Bilhética com lugares marcados, RSVP, adesões, passes de série, questionários de seleção, quadros de contribuições e check-in por QR.'
		},
		{
			icon: 'globe',
			title: 'API REST documentada',
			description:
				'A documentação OpenAPI vem incluída, por isso podes automatizar a tua instância com scripts ou criar as tuas próprias ferramentas por cima.'
		}
	],
	benefits: {
		title: 'Porquê instalar por conta própria',
		items: [
			'Nenhuma comissão para nós em nenhum bilhete ou transação',
			'Escolhe o país e o fornecedor onde vivem os teus dados',
			'Os serviços opcionais ficam desligados até os configurares',
			'Adapta o código à forma como a tua comunidade funciona',
			'Início de sessão único com Google ou qualquer fornecedor OpenID Connect, como o Keycloak',
			'Os issues e o desenvolvimento acontecem às claras no GitHub'
		]
	},
	cta: {
		title: 'Põe a tua própria instância a funcionar',
		description:
			'Descarrega o código e o guia de implementação, ou dá primeiro uma volta pela demo alojada.',
		buttons: [
			{ text: 'Ver no GitHub', href: 'https://github.com/letsrevel', variant: 'primary' },
			{ text: 'Experimentar a demo', href: 'https://demo.letsrevel.io', variant: 'secondary' },
			{ text: 'Contacta-nos', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'De que preciso para correr o Revel?',
			answer:
				'Um servidor Linux x86-64, um domínio com dois nomes de host a apontar para ele e as portas 80 e 443 abertas. A configuração leve corre com 2 vCPU e 4 GB de RAM, o que custa cerca de 20 € por mês na maioria dos fornecedores de alojamento. Comunidades maiores podem passar para a configuração completa.'
		},
		{
			question: 'Preciso de uma conta Stripe?',
			answer:
				'Só se quiseres receber pagamentos online. Eventos gratuitos, RSVP e bilhetes pagos offline ou à entrada funcionam todos sem ela.'
		},
		{
			question: 'Qual é a diferença em relação à vossa versão alojada?',
			answer:
				'É o mesmo código. Na versão alojada tratamos nós dos servidores, das atualizações e das cópias de segurança, e ficamos com 1,5 % + 0,25 € nos pagamentos online. Quando alojas por conta própria, tudo isso fica a teu cargo, incluindo configurar serviços opcionais como o email, os passes para wallet ou a integração com o Eventbrite com as tuas próprias credenciais.'
		},
		{
			question: 'Que idiomas suporta?',
			answer:
				'A interface está disponível em inglês, alemão, italiano, francês, espanhol e português, e cada pessoa escolhe o seu.'
		},
		{
			question: 'Posso ter ajuda se alojar por conta própria?',
			answer:
				'Abre um issue no GitHub e nós damos uma vista de olhos. Se precisares de um apoio mais próximo, fala connosco e conversamos sobre isso.'
		}
	],
	relatedPages: ['eventbrite-alternative', 'privacy-focused-events']
};

export const selfHostedEventPlatformIT: LandingPageContent = {
	slug: 'self-hosted-event-platform',
	locale: 'it',
	meta: {
		title: 'Gestione eventi self-hosted, open source e gratis | Revel',
		description:
			'Installa Revel sul tuo server con licenza MIT. Biglietteria, RSVP, iscrizioni, questionari di screening e check-in QR senza commissioni di piattaforma. Setup con Docker Compose.',
		keywords:
			'gestione eventi self hosted, biglietteria open source, software eventi open source, alternativa a eventbrite, self hosted eventbrite, piattaforma eventi docker'
	},
	hero: {
		headline: 'I tuoi eventi, il tuo server, zero commissioni',
		subheadline:
			'Revel è un software per eventi con licenza MIT che puoi gestire in autonomia. Lo stesso codice della nostra versione hosted, su hardware che controlli tu.'
	},
	intro: {
		paragraphs: [
			"C'è chi organizza eventi e vuole i dati della propria community su una macchina che controlla. E c'è chi semplicemente non vuole cedere una fetta di ogni biglietto. In entrambi i casi, Revel è open source e puoi installarlo in autonomia.",
			"L'intero stack arriva come Docker Compose: Django, PostgreSQL con PostGIS, Redis, Celery e Caddy, che si occupa dell'HTTPS. Uno script di setup ti guida nella configurazione, e per iniziare basta un piccolo server con 2 vCPU e 4 GB di RAM.",
			'Tutto ciò che va oltre il nucleo è opzionale. Collega Stripe quando vuoi vendere biglietti online, SMTP per le email, le credenziali di Apple Wallet e Google Wallet per i pass, un provider OpenID Connect per il single sign-on o Telegram per le notifiche. Quello che non ti serve, lo lasci fuori.'
		]
	},
	features: [
		{
			icon: 'server',
			title: 'Setup con Docker Compose',
			description:
				"Un solo file compose per l'intero stack e una procedura guidata che fa le domande giuste. Ti servono un server Linux, due hostname e le porte 80 e 443."
		},
		{
			icon: 'euro',
			title: 'Zero commissioni di piattaforma',
			description:
				"Il nostro 1,5% + €0,25 si applica solo alla versione hosted. Sul tuo server paghi l'hosting e, se vendi online, la commissione di elaborazione di Stripe."
		},
		{
			icon: 'code',
			title: 'Licenza MIT',
			description:
				'Usalo per scopi commerciali, fanne un fork, modificalo. Backend, frontend e configurazione di deployment sono tutti pubblici.'
		},
		{
			icon: 'lock',
			title: 'I tuoi dati restano a casa',
			description:
				'Liste delle persone partecipanti, risposte ai questionari e dati dei pagamenti stanno nel tuo database. Decidi tu dove gira e chi può accedervi.'
		},
		{
			icon: 'ticket',
			title: 'Tutte le funzionalità',
			description:
				'Biglietteria con posti assegnati, RSVP, iscrizioni, pass di serie, questionari di screening, bacheche potluck e check-in QR.'
		},
		{
			icon: 'globe',
			title: 'API REST documentata',
			description:
				'La documentazione OpenAPI è integrata, così puoi automatizzare la tua istanza con degli script o costruirci sopra i tuoi strumenti.'
		}
	],
	benefits: {
		title: 'Perché gestirlo in autonomia',
		items: [
			'Nessuna commissione per noi su biglietti o transazioni',
			'Scegli il paese e il provider che ospitano i tuoi dati',
			'I servizi opzionali restano spenti finché non li configuri',
			'Adatta il codice al modo in cui funziona la tua community',
			'Single sign-on con Google o qualsiasi provider OpenID Connect, come Keycloak',
			'Segnalazioni e sviluppo avvengono alla luce del sole su GitHub'
		]
	},
	cta: {
		title: 'Avvia la tua istanza',
		description:
			"Prendi il codice e la guida al deployment, oppure dai prima un'occhiata alla demo hosted.",
		buttons: [
			{ text: 'Vedi su GitHub', href: 'https://github.com/letsrevel', variant: 'primary' },
			{ text: 'Prova la demo', href: 'https://demo.letsrevel.io', variant: 'secondary' },
			{ text: 'Contattaci', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Cosa mi serve per far girare Revel?',
			answer:
				'Un server Linux x86-64, un dominio con due hostname che puntano al server e le porte 80 e 443 aperte. Il setup leggero gira con 2 vCPU e 4 GB di RAM, che presso la maggior parte dei provider costa circa 20 € al mese. Le community più grandi possono passare al setup completo.'
		},
		{
			question: 'Mi serve un account Stripe?',
			answer:
				"Solo se vuoi ricevere pagamenti online. Eventi gratuiti, RSVP e biglietti pagati offline o all'ingresso funzionano tutti anche senza."
		},
		{
			question: 'In cosa è diverso dalla vostra versione hosted?',
			answer:
				"È lo stesso codice. Nella versione hosted gestiamo noi server, aggiornamenti e backup, e tratteniamo 1,5% + €0,25 sui pagamenti online. Se fai self-hosting, tutto questo spetta a te, compresa la configurazione dei servizi opzionali come email, pass per il wallet o l'integrazione con Eventbrite, con le tue credenziali."
		},
		{
			question: 'Quali lingue supporta?',
			answer:
				"L'interfaccia è disponibile in inglese, tedesco, italiano, francese, spagnolo e portoghese, e ogni persona sceglie la propria."
		},
		{
			question: 'Posso avere aiuto se faccio self-hosting?',
			answer:
				"Apri una issue su GitHub e ci diamo un'occhiata. Se ti serve un supporto più diretto, scrivici e ne parliamo."
		}
	],
	relatedPages: ['eventbrite-alternative', 'privacy-focused-events']
};

export const selfHostedEventPlatformFR: LandingPageContent = {
	slug: 'self-hosted-event-platform',
	locale: 'fr',
	meta: {
		title: 'Gestion d’événements auto-hébergée, open source et gratuite | Revel',
		description:
			'Fais tourner Revel sur ton propre serveur sous licence MIT. Billetterie, RSVP, adhésions, questionnaires de sélection et check-in par QR code, sans commission de plateforme. Installation avec Docker Compose.',
		keywords:
			'gestion d’événements auto-hébergée, billetterie open source, logiciel événementiel open source, alternative eventbrite, self hosted eventbrite, plateforme événementielle docker'
	},
	hero: {
		headline: 'Tes événements, ton serveur, zéro commission',
		subheadline:
			'Revel est un logiciel événementiel sous licence MIT que tu peux héberger toi-même. Le même code que notre version hébergée, sur du matériel que tu contrôles.'
	},
	intro: {
		paragraphs: [
			'Certaines personnes qui organisent des événements veulent garder les données de leur communauté sur une machine qu’elles contrôlent. D’autres ne veulent tout simplement pas céder une part de chaque billet. Dans les deux cas, Revel est open source et tu peux l’héberger toi-même.',
			'Toute la stack est livrée en Docker Compose : Django, PostgreSQL avec PostGIS, Redis, Celery, et Caddy qui s’occupe du HTTPS. Un script d’installation te guide dans la configuration, et un petit serveur avec 2 vCPU et 4 Go de RAM suffit pour démarrer.',
			'Tout ce qui dépasse le cœur est optionnel. Branche Stripe quand tu veux vendre des billets en ligne, SMTP pour les e-mails, des identifiants Apple Wallet et Google Wallet pour les passes, un fournisseur OpenID Connect pour l’authentification unique, ou Telegram pour les notifications. Laisse de côté ce dont tu n’as pas besoin.'
		]
	},
	features: [
		{
			icon: 'server',
			title: 'Installation avec Docker Compose',
			description:
				'Un seul fichier compose pour toute la stack et un assistant de configuration qui pose les bonnes questions. Il te faut un serveur Linux, deux noms d’hôte et les ports 80 et 443.'
		},
		{
			icon: 'euro',
			title: 'Zéro commission de plateforme',
			description:
				'Nos 1,5 % + 0,25 € ne s’appliquent qu’à la version hébergée. Sur ton propre serveur, tu paies l’hébergement et, si tu vends en ligne, les frais de traitement de Stripe.'
		},
		{
			icon: 'code',
			title: 'Sous licence MIT',
			description:
				'Utilise-le à des fins commerciales, forke-le, modifie-le. Le backend, le frontend et la configuration de déploiement sont tous publics.'
		},
		{
			icon: 'lock',
			title: 'Tes données restent chez toi',
			description:
				'Listes de participant·es, réponses aux questionnaires et données de paiement sont stockées dans ta propre base de données. C’est toi qui décides où elle tourne et qui peut y accéder.'
		},
		{
			icon: 'ticket',
			title: 'Toutes les fonctionnalités',
			description:
				'Billetterie avec placement numéroté, RSVP, adhésions, pass de série, questionnaires de sélection, tableaux de repas partagé et check-in par QR code.'
		},
		{
			icon: 'globe',
			title: 'API REST documentée',
			description:
				'La documentation OpenAPI est intégrée : tu peux piloter ton instance par script ou construire tes propres outils par-dessus.'
		}
	],
	benefits: {
		title: 'Pourquoi l’héberger toi-même',
		items: [
			'Aucune commission pour nous, sur aucun billet ni aucune transaction',
			'Choisis le pays et l’hébergeur où vivent tes données',
			'Les services optionnels restent désactivés tant que tu ne les configures pas',
			'Adapte le code au fonctionnement de ta communauté',
			'Authentification unique avec Google ou n’importe quel fournisseur OpenID Connect, comme Keycloak',
			'Les issues et le développement se font publiquement sur GitHub'
		]
	},
	cta: {
		title: 'Lance ta propre instance',
		description:
			'Récupère le code et le guide de déploiement, ou fais d’abord un tour sur la démo hébergée.',
		buttons: [
			{ text: 'Voir sur GitHub', href: 'https://github.com/letsrevel', variant: 'primary' },
			{ text: 'Essayer la démo', href: 'https://demo.letsrevel.io', variant: 'secondary' },
			{ text: 'Nous contacter', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'De quoi ai-je besoin pour faire tourner Revel ?',
			answer:
				'Un serveur Linux x86-64, un domaine avec deux noms d’hôte qui pointent vers lui, et les ports 80 et 443 ouverts. La configuration légère tourne sur 2 vCPU et 4 Go de RAM, ce qui coûte environ 20 € par mois chez la plupart des hébergeurs. Les communautés plus grandes peuvent passer à la configuration complète.'
		},
		{
			question: 'Ai-je besoin d’un compte Stripe ?',
			answer:
				'Seulement si tu veux encaisser des paiements en ligne. Les événements gratuits, les RSVP et les billets payés hors ligne ou à l’entrée fonctionnent tous sans.'
		},
		{
			question: 'Qu’est-ce qui change par rapport à votre version hébergée ?',
			answer:
				'C’est le même code. Sur la version hébergée, nous gérons les serveurs, les mises à jour et les sauvegardes, et nous prenons 1,5 % + 0,25 € sur les paiements en ligne. En auto-hébergement, tout ça est à ta charge, y compris la configuration des services optionnels comme l’e-mail, les passes Wallet ou l’intégration Eventbrite avec tes propres identifiants.'
		},
		{
			question: 'Quelles langues sont disponibles ?',
			answer:
				'L’interface existe en anglais, allemand, italien, français, espagnol et portugais, et chaque personne choisit la sienne.'
		},
		{
			question: 'Puis-je obtenir de l’aide en auto-hébergement ?',
			answer:
				'Ouvre une issue sur GitHub et nous y jetterons un œil. Si tu as besoin d’un accompagnement plus poussé, contacte-nous et on en parle.'
		}
	],
	relatedPages: ['eventbrite-alternative', 'privacy-focused-events']
};
