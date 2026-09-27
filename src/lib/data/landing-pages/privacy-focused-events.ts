import type { LandingPageContent } from './types';

export const privacyFocusedEventsEN: LandingPageContent = {
	slug: 'privacy-focused-events',
	locale: 'en',
	meta: {
		title: 'Privacy-First Event Platform, Built for GDPR | Revel',
		description:
			'Event management without trackers or ads. Only essential cookies, data export and account deletion built in, hosted in Europe, and open source so you can check.',
		keywords:
			'gdpr event platform, privacy focused events, european event software, data protection events, private event management'
	},
	hero: {
		headline: 'Events Without the Surveillance',
		subheadline:
			'No ads, no analytics trackers, no selling your guest list. Just the tools you need to run your events.'
	},
	intro: {
		paragraphs: [
			'Plenty of event platforms make part of their money from what they know about your attendees. That is why their pages come loaded with tracking pixels and their privacy policies go on for pages.',
			"Revel doesn't work that way. There's no analytics script on the site, only essential cookies, and even the fonts come from our own servers. We earn money from a small fee on paid tickets, not from data, so there's nothing to gain by collecting more.",
			"The code is open source, so you don't have to take our word for any of this. And if you want the data on your own hardware, you can self-host."
		]
	},
	features: [
		{
			icon: 'shield',
			title: 'No Tracking Scripts',
			description:
				'No Google Analytics, no ad pixels, no third-party SDKs following your attendees around the web.'
		},
		{
			icon: 'eye',
			title: 'You Decide What Guests See',
			description:
				'Choose per event whether the guest list, the headcount and the address are visible, and to whom. Attendees can also hide themselves from lists.'
		},
		{
			icon: 'lock',
			title: 'Ask Only What You Need',
			description:
				'Pronouns, a profile photo or questionnaire answers are only requested when your event actually calls for them.'
		},
		{
			icon: 'check',
			title: 'Export and Delete, Built In',
			description:
				'Anyone can download their personal data or delete their account from their own settings. No emails to a support inbox.'
		},
		{
			icon: 'globe',
			title: 'Hosted in Europe',
			description: 'Our hosted version runs on European servers, under EU data protection law.'
		},
		{
			icon: 'code',
			title: 'Open Source and Self-Hostable',
			description:
				'Read exactly how data is handled, or run Revel on your own server so it never leaves your hands.'
		}
	],
	benefits: {
		title: 'Privacy You Can Explain to Your Community',
		items: [
			'No advertising business, so no reason to collect more than we need',
			'Only essential cookies',
			'Guest list and address visibility set per event',
			'Two-factor authentication for every account',
			'Data export and account deletion without a support ticket',
			'Self-hosting for when the data has to stay on your own servers'
		]
	},
	cta: {
		title: 'Run Events Your Attendees Can Trust',
		description: 'Look around the demo, or read the code for yourself.',
		buttons: [
			{ text: 'Try the Live Demo', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Self-Host (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Contact Us', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Does Revel help with GDPR?',
			answer:
				"It was designed with it in mind. We collect what's needed to run events, attendees can export or delete their data on their own, and the hosted version runs in Europe. You're still responsible for what you ask your attendees, but Revel makes it easy to keep that to a minimum."
		},
		{
			question: 'Do you sell attendee data?',
			answer:
				'No. On the hosted version we earn a fee on paid online transactions (1.5% + €0.25). There is no ad business and there are no data deals.'
		},
		{
			question: 'What data does Revel collect?',
			answer:
				"Your account details, the events you organize or attend, tickets and payments, and whatever an organizer asks in a questionnaire. We don't track browsing across other sites and we don't build ad profiles."
		},
		{
			question: 'Are any third parties involved?',
			answer:
				"Only where they're needed. Stripe processes card payments, a venue map loads from the map provider when an event shows one, and Apple or Google are involved when someone adds a pass to their wallet. There are no analytics or advertising services."
		},
		{
			question: 'Can I keep all the data on my own servers?',
			answer:
				'Yes. Self-host Revel under the MIT license and everything Revel stores lives in your own database, wherever you run it. Data only leaves it when you switch on an outside service, like Stripe for online payments.'
		}
	],
	relatedPages: ['self-hosted-event-platform', 'queer-event-management']
};

export const privacyFocusedEventsDE: LandingPageContent = {
	slug: 'privacy-focused-events',
	locale: 'de',
	meta: {
		title: 'Event-Plattform mit Datenschutz zuerst, gebaut für die DSGVO | Revel',
		description:
			'Event-Management ohne Tracker und Werbung. Nur notwendige Cookies, Datenexport und Kontolöschung eingebaut, Hosting in Europa und Open Source, damit du es selbst prüfen kannst.',
		keywords:
			'dsgvo event plattform, datenschutz events, datenschutzfreundliche veranstaltungsplattform, europäische event software, ticketing ohne tracking, private event verwaltung'
	},
	hero: {
		headline: 'Events ohne Überwachung',
		subheadline:
			'Keine Werbung, keine Analyse-Tracker, kein Verkauf deiner Gästeliste. Nur die Werkzeuge, die du für deine Events brauchst.'
	},
	intro: {
		paragraphs: [
			'Viele Event-Plattformen verdienen einen Teil ihres Geldes mit dem, was sie über deine Teilnehmer*innen wissen. Deshalb stecken ihre Seiten voller Tracking-Pixel und ihre Datenschutzerklärungen ziehen sich über viele Seiten.',
			'Bei Revel läuft das anders. Auf der Seite gibt es kein Analyse-Skript, nur notwendige Cookies, und selbst die Schriften kommen von unseren eigenen Servern. Wir verdienen an einer kleinen Gebühr auf bezahlte Tickets, nicht an Daten. Mehr zu sammeln bringt uns also nichts.',
			'Der Code ist Open Source, du musst uns also nichts davon einfach glauben. Und wenn du die Daten auf deiner eigenen Hardware haben willst, kannst du Revel selbst hosten.'
		]
	},
	features: [
		{
			icon: 'shield',
			title: 'Keine Tracking-Skripte',
			description:
				'Kein Google Analytics, keine Werbe-Pixel, keine Drittanbieter-SDKs, die deinen Teilnehmer*innen durchs Netz folgen.'
		},
		{
			icon: 'eye',
			title: 'Du entscheidest, was Gäste sehen',
			description:
				'Leg pro Event fest, ob Gästeliste, Gästezahl und Adresse sichtbar sind, und für wen. Teilnehmer*innen können sich außerdem selbst aus Listen ausblenden.'
		},
		{
			icon: 'lock',
			title: 'Frag nur, was du brauchst',
			description:
				'Pronomen, ein Profilfoto oder Antworten auf einen Fragebogen werden nur abgefragt, wenn dein Event sie wirklich braucht.'
		},
		{
			icon: 'check',
			title: 'Export und Löschung eingebaut',
			description:
				'Alle können ihre persönlichen Daten herunterladen oder ihr Konto direkt in den eigenen Einstellungen löschen. Keine E-Mails an ein Support-Postfach.'
		},
		{
			icon: 'globe',
			title: 'Gehostet in Europa',
			description:
				'Unsere gehostete Version läuft auf europäischen Servern, unter EU-Datenschutzrecht.'
		},
		{
			icon: 'code',
			title: 'Open Source und selbst hostbar',
			description:
				'Lies genau nach, wie mit Daten umgegangen wird, oder betreib Revel auf deinem eigenen Server, damit die Daten nie deine Hände verlassen.'
		}
	],
	benefits: {
		title: 'Datenschutz, den du deiner Community erklären kannst',
		items: [
			'Kein Werbegeschäft, also kein Grund, mehr zu sammeln als nötig',
			'Nur notwendige Cookies',
			'Sichtbarkeit von Gästeliste und Adresse pro Event einstellbar',
			'Zwei-Faktor-Authentifizierung für jedes Konto',
			'Datenexport und Kontolöschung ohne Support-Ticket',
			'Selbst-Hosting, wenn die Daten auf deinen eigenen Servern bleiben müssen'
		]
	},
	cta: {
		title: 'Events, denen deine Teilnehmer*innen vertrauen können',
		description: 'Schau dich in der Demo um oder lies den Code selbst.',
		buttons: [
			{ text: 'Live-Demo ausprobieren', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{
				text: 'Selbst hosten (GitHub)',
				href: 'https://github.com/letsrevel',
				variant: 'secondary'
			},
			{ text: 'Kontakt', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Hilft Revel bei der DSGVO?',
			answer:
				'Revel wurde mit der DSGVO im Blick entwickelt. Wir erheben, was nötig ist, um Events durchzuführen, Teilnehmer*innen können ihre Daten selbst exportieren oder löschen, und die gehostete Version läuft in Europa. Für das, was du deine Teilnehmer*innen fragst, bist du weiterhin selbst verantwortlich, aber Revel macht es leicht, das auf ein Minimum zu beschränken.'
		},
		{
			question: 'Verkauft ihr Teilnehmer*innendaten?',
			answer:
				'Nein. Bei der gehosteten Version verdienen wir an einer Gebühr auf bezahlte Online-Transaktionen (1,5% + 0,25€). Es gibt kein Werbegeschäft und keine Datendeals.'
		},
		{
			question: 'Welche Daten erhebt Revel?',
			answer:
				'Deine Kontodaten, die Events, die du organisierst oder besuchst, Tickets und Zahlungen sowie alles, was Veranstalter*innen in einem Fragebogen abfragen. Wir verfolgen dein Surfverhalten nicht über andere Websites hinweg und erstellen keine Werbeprofile.'
		},
		{
			question: 'Sind Dritte beteiligt?',
			answer:
				'Nur wo es nötig ist. Stripe wickelt Kartenzahlungen ab, eine Karte des Veranstaltungsorts wird vom Kartenanbieter geladen, wenn ein Event eine anzeigt, und Apple oder Google sind beteiligt, wenn jemand einen Pass zum Wallet hinzufügt. Analyse- oder Werbedienste gibt es keine.'
		},
		{
			question: 'Kann ich alle Daten auf meinen eigenen Servern behalten?',
			answer:
				'Ja. Hoste Revel selbst unter der MIT-Lizenz, und alles, was Revel speichert, liegt in deiner eigenen Datenbank, wo auch immer du sie betreibst. Daten verlassen sie nur, wenn du einen externen Dienst einschaltest, etwa Stripe für Online-Zahlungen.'
		}
	],
	relatedPages: ['self-hosted-event-platform', 'queer-event-management']
};

export const privacyFocusedEventsIT: LandingPageContent = {
	slug: 'privacy-focused-events',
	locale: 'it',
	meta: {
		title: 'Piattaforma eventi che mette la privacy al primo posto, pensata per il GDPR | Revel',
		description:
			'Gestione eventi senza tracker né pubblicità. Solo cookie essenziali, export dei dati e cancellazione dell’account integrati, hosting in Europa e codice open source, così puoi verificare di persona.',
		keywords:
			'piattaforma eventi gdpr, eventi privacy, gestione eventi senza tracciamento, software eventi europeo, protezione dati eventi, biglietteria senza tracker'
	},
	hero: {
		headline: 'Eventi senza sorveglianza',
		subheadline:
			'Niente pubblicità, niente tracker di analytics, nessuna vendita della tua lista ospiti. Solo gli strumenti che ti servono per organizzare i tuoi eventi.'
	},
	intro: {
		paragraphs: [
			'Molte piattaforme per eventi guadagnano in parte da quello che sanno sulle persone che partecipano. Per questo le loro pagine sono piene di pixel di tracciamento e le loro informative sulla privacy non finiscono mai.',
			"Revel non funziona così. Sul sito non c'è nessuno script di analytics, solo cookie essenziali, e persino i font arrivano dai nostri server. Guadagniamo con una piccola commissione sui biglietti a pagamento, non con i dati, quindi raccoglierne di più non ci porterebbe nulla.",
			'Il codice è open source, quindi non devi fidarti sulla parola. E se vuoi tenere i dati sul tuo hardware, puoi fare self-hosting.'
		]
	},
	features: [
		{
			icon: 'shield',
			title: 'Nessuno script di tracciamento',
			description:
				'Niente Google Analytics, niente pixel pubblicitari, nessun SDK di terze parti che segue le persone partecipanti in giro per il web.'
		},
		{
			icon: 'eye',
			title: 'Decidi tu cosa vedono gli ospiti',
			description:
				"Scegli per ogni evento se la lista ospiti, il numero di partecipanti e l'indirizzo sono visibili, e a chi. Chi partecipa può anche nascondersi dalle liste."
		},
		{
			icon: 'lock',
			title: 'Chiedi solo quello che ti serve',
			description:
				'Pronomi, foto profilo o risposte a un questionario vengono richiesti solo quando il tuo evento ne ha davvero bisogno.'
		},
		{
			icon: 'check',
			title: 'Export e cancellazione integrati',
			description:
				"Chiunque può scaricare i propri dati personali o cancellare l'account dalle proprie impostazioni. Nessuna email a una casella di supporto."
		},
		{
			icon: 'globe',
			title: 'Hosting in Europa',
			description:
				'La nostra versione hosted gira su server europei, sotto la normativa UE sulla protezione dei dati.'
		},
		{
			icon: 'code',
			title: 'Open source e self-hostable',
			description:
				'Leggi esattamente come vengono trattati i dati, oppure fai girare Revel sul tuo server, così i dati non escono mai dalle tue mani.'
		}
	],
	benefits: {
		title: 'Una privacy che puoi spiegare alla tua community',
		items: [
			'Nessun business pubblicitario, quindi nessun motivo di raccogliere più del necessario',
			'Solo cookie essenziali',
			'Visibilità di lista ospiti e indirizzo impostabile per ogni evento',
			'Autenticazione a due fattori per ogni account',
			'Export dei dati e cancellazione dell’account senza aprire un ticket',
			'Self-hosting per quando i dati devono restare sui tuoi server'
		]
	},
	cta: {
		title: 'Eventi di cui le persone partecipanti possono fidarsi',
		description: 'Dai un’occhiata alla demo, oppure leggi il codice con i tuoi occhi.',
		buttons: [
			{ text: 'Prova la demo live', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Self-host (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Contattaci', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Revel aiuta con il GDPR?',
			answer:
				'È stato progettato tenendolo presente. Raccogliamo quello che serve per gestire gli eventi, chi partecipa può esportare o cancellare i propri dati in autonomia, e la versione hosted gira in Europa. Resti tu responsabile di quello che chiedi alle persone partecipanti, ma Revel ti rende facile ridurlo al minimo.'
		},
		{
			question: 'Vendete i dati delle persone partecipanti?',
			answer:
				'No. Sulla versione hosted guadagniamo con una commissione sulle transazioni online a pagamento (1,5% + €0,25). Non c’è nessun business pubblicitario e nessun accordo sui dati.'
		},
		{
			question: 'Quali dati raccoglie Revel?',
			answer:
				'I dati del tuo account, gli eventi che organizzi o a cui partecipi, biglietti e pagamenti, e quello che chi organizza chiede in un questionario. Non tracciamo la tua navigazione su altri siti e non costruiamo profili pubblicitari.'
		},
		{
			question: 'Sono coinvolte terze parti?',
			answer:
				'Solo dove servono. Stripe elabora i pagamenti con carta, la mappa del luogo viene caricata dal fornitore della mappa quando un evento ne mostra una, e Apple o Google entrano in gioco quando qualcuno aggiunge un pass al proprio wallet. Non ci sono servizi di analytics né pubblicitari.'
		},
		{
			question: 'Posso tenere tutti i dati sui miei server?',
			answer:
				'Sì. Fai self-hosting di Revel con licenza MIT e tutto ciò che Revel salva resta nel tuo database, ovunque tu lo faccia girare. I dati escono solo se attivi un servizio esterno, come Stripe per i pagamenti online.'
		}
	],
	relatedPages: ['self-hosted-event-platform', 'queer-event-management']
};

export const privacyFocusedEventsFR: LandingPageContent = {
	slug: 'privacy-focused-events',
	locale: 'fr',
	meta: {
		title: 'Plateforme événementielle respectueuse de la vie privée, pensée pour le RGPD | Revel',
		description:
			"Une gestion d'événements sans traqueurs ni publicité. Uniquement des cookies essentiels, export des données et suppression du compte intégrés, hébergement en Europe et code open source pour que tu puisses vérifier.",
		keywords:
			'plateforme événementielle rgpd, événements respect vie privée, billetterie sans tracking, logiciel événementiel européen, protection données personnelles événements, gestion événements privés'
	},
	hero: {
		headline: 'Des événements sans surveillance',
		subheadline:
			'Pas de pub, pas de traqueurs analytiques, pas de revente de ta liste de personnes invitées. Juste les outils dont tu as besoin pour organiser tes événements.'
	},
	intro: {
		paragraphs: [
			"Beaucoup de plateformes événementielles tirent une partie de leurs revenus de ce qu'elles savent sur les personnes qui participent. C'est pour ça que leurs pages sont bourrées de pixels de suivi et que leurs politiques de confidentialité s'étalent sur des pages entières.",
			"Revel ne fonctionne pas comme ça. Le site n'a aucun script d'analyse, uniquement des cookies essentiels, et même les polices viennent de nos propres serveurs. On gagne de l'argent grâce à une petite commission sur les billets payants, pas grâce aux données, donc collecter plus ne nous apporterait rien.",
			"Le code est open source, tu n'as donc pas à nous croire sur parole. Et si tu veux garder les données sur ton propre matériel, tu peux auto-héberger Revel."
		]
	},
	features: [
		{
			icon: 'shield',
			title: 'Aucun script de suivi',
			description:
				'Pas de Google Analytics, pas de pixels publicitaires, pas de SDK tiers qui suivent tes participant·es partout sur le web.'
		},
		{
			icon: 'eye',
			title: 'Tu décides ce que voient les personnes invitées',
			description:
				"Choisis pour chaque événement si la liste des personnes invitées, leur nombre et l'adresse sont visibles, et pour qui. Les participant·es peuvent aussi se masquer des listes."
		},
		{
			icon: 'lock',
			title: 'Ne demande que le nécessaire',
			description:
				'Les pronoms, une photo de profil ou des réponses à un questionnaire ne sont demandés que si ton événement en a vraiment besoin.'
		},
		{
			icon: 'check',
			title: 'Export et suppression intégrés',
			description:
				"Chaque personne peut télécharger ses données personnelles ou supprimer son compte depuis ses propres paramètres. Pas besoin d'écrire au support."
		},
		{
			icon: 'globe',
			title: 'Hébergé en Europe',
			description:
				'Notre version hébergée tourne sur des serveurs européens, sous le droit européen de la protection des données.'
		},
		{
			icon: 'code',
			title: 'Open source et auto-hébergeable',
			description:
				'Lis exactement comment les données sont traitées, ou fais tourner Revel sur ton propre serveur pour qu’elles ne sortent jamais de tes mains.'
		}
	],
	benefits: {
		title: 'Une confidentialité que tu peux expliquer à ta communauté',
		items: [
			'Aucune activité publicitaire, donc aucune raison de collecter plus que nécessaire',
			'Uniquement des cookies essentiels',
			"Visibilité de la liste des personnes invitées et de l'adresse réglable pour chaque événement",
			'Authentification à deux facteurs pour chaque compte',
			'Export des données et suppression du compte sans ticket au support',
			"L'auto-hébergement quand les données doivent rester sur tes propres serveurs"
		]
	},
	cta: {
		title: 'Des événements dignes de la confiance de tes participant·es',
		description: 'Fais un tour dans la démo, ou lis le code par toi-même.',
		buttons: [
			{ text: 'Essayer la démo live', href: 'https://demo.letsrevel.io', variant: 'primary' },
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
			question: 'Revel aide-t-il pour le RGPD ?',
			answer:
				"Il a été conçu dans cet esprit. On collecte ce qui est nécessaire pour faire tourner les événements, les participant·es peuvent exporter ou supprimer leurs données en autonomie, et la version hébergée tourne en Europe. Tu restes responsable de ce que tu demandes à tes participant·es, mais Revel t'aide à garder ça au strict minimum."
		},
		{
			question: 'Vendez-vous les données des participant·es ?',
			answer:
				"Non. Sur la version hébergée, on touche une commission sur les transactions en ligne payantes (1,5 % + 0,25 €). Il n'y a aucune activité publicitaire et aucun accord de revente de données."
		},
		{
			question: 'Quelles données Revel collecte-t-il ?',
			answer:
				"Les informations de ton compte, les événements que tu organises ou auxquels tu participes, les billets et les paiements, et tout ce que l'équipe organisatrice demande dans un questionnaire. On ne suit pas ta navigation sur d'autres sites et on ne crée pas de profils publicitaires."
		},
		{
			question: 'Des tiers interviennent-ils ?',
			answer:
				"Seulement quand c'est nécessaire. Stripe traite les paiements par carte, la carte du lieu est chargée depuis le fournisseur de cartes quand un événement en affiche une, et Apple ou Google interviennent quand quelqu'un ajoute un pass à son wallet. Il n'y a aucun service d'analyse ni de publicité."
		},
		{
			question: 'Puis-je garder toutes les données sur mes propres serveurs ?',
			answer:
				'Oui. Auto-héberge Revel sous licence MIT et tout ce que Revel enregistre reste dans ta propre base de données, où que tu la fasses tourner. Les données n’en sortent que si tu actives un service externe, comme Stripe pour les paiements en ligne.'
		}
	],
	relatedPages: ['self-hosted-event-platform', 'queer-event-management']
};

export const privacyFocusedEventsES: LandingPageContent = {
	slug: 'privacy-focused-events',
	locale: 'es',
	meta: {
		title: 'Plataforma de eventos que prioriza la privacidad, pensada para el RGPD | Revel',
		description:
			'Gestión de eventos sin rastreadores ni anuncios. Solo cookies esenciales, exportación de datos y eliminación de cuenta integradas, alojamiento en Europa y código abierto para que puedas comprobarlo.',
		keywords:
			'plataforma de eventos rgpd, eventos con privacidad, gestión de eventos sin rastreo, software de eventos europeo, protección de datos en eventos, venta de entradas sin rastreadores'
	},
	hero: {
		headline: 'Eventos sin vigilancia',
		subheadline:
			'Sin anuncios, sin rastreadores de analítica, sin vender tu lista de personas invitadas. Solo las herramientas que necesitas para organizar tus eventos.'
	},
	intro: {
		paragraphs: [
			'Muchas plataformas de eventos ganan parte de su dinero con lo que saben de las personas asistentes. Por eso sus páginas vienen cargadas de píxeles de seguimiento y sus políticas de privacidad ocupan páginas y páginas.',
			'Revel no funciona así. En el sitio no hay ningún script de analítica, solo cookies esenciales, e incluso las fuentes se sirven desde nuestros propios servidores. Ganamos dinero con una pequeña comisión sobre las entradas de pago, no con datos, así que no ganamos nada recopilando más.',
			'El código es abierto, así que no tienes que fiarte de nuestra palabra. Y si quieres tener los datos en tu propio hardware, puedes autoalojarlo.'
		]
	},
	features: [
		{
			icon: 'shield',
			title: 'Sin scripts de rastreo',
			description:
				'Nada de Google Analytics, nada de píxeles publicitarios, nada de SDK de terceros persiguiendo a tus asistentes por toda la web.'
		},
		{
			icon: 'eye',
			title: 'Tú decides qué ve tu gente',
			description:
				'Elige en cada evento si la lista de personas invitadas, el número de asistentes y la dirección son visibles, y para quién. Las personas asistentes también pueden ocultarse de las listas.'
		},
		{
			icon: 'lock',
			title: 'Pide solo lo que necesitas',
			description:
				'Los pronombres, una foto de perfil o las respuestas a un cuestionario solo se piden cuando tu evento de verdad los necesita.'
		},
		{
			icon: 'check',
			title: 'Exportar y eliminar, integrado',
			description:
				'Cualquiera puede descargar sus datos personales o eliminar su cuenta desde sus propios ajustes. Sin correos a un buzón de soporte.'
		},
		{
			icon: 'globe',
			title: 'Alojado en Europa',
			description:
				'Nuestra versión alojada funciona en servidores europeos, bajo la legislación de protección de datos de la UE.'
		},
		{
			icon: 'code',
			title: 'Código abierto y autoalojable',
			description:
				'Lee exactamente cómo se tratan los datos, o ejecuta Revel en tu propio servidor para que nunca salgan de tus manos.'
		}
	],
	benefits: {
		title: 'Una privacidad que puedes explicar a tu comunidad',
		items: [
			'Sin negocio publicitario, así que sin motivos para recopilar más de lo necesario',
			'Solo cookies esenciales',
			'Visibilidad de la lista de personas invitadas y de la dirección configurable en cada evento',
			'Autenticación en dos pasos para todas las cuentas',
			'Exportación de datos y eliminación de cuenta sin abrir un ticket de soporte',
			'Autoalojamiento para cuando los datos tienen que quedarse en tus propios servidores'
		]
	},
	cta: {
		title: 'Organiza eventos en los que tus asistentes puedan confiar',
		description: 'Echa un vistazo a la demo, o lee el código por tu cuenta.',
		buttons: [
			{ text: 'Probar la demo en vivo', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Autoalojar (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Contáctanos', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: '¿Revel ayuda con el RGPD?',
			answer:
				'Se diseñó teniéndolo en cuenta. Recopilamos lo necesario para gestionar eventos, las personas asistentes pueden exportar o eliminar sus datos por su cuenta y la versión alojada funciona en Europa. Tú sigues siendo responsable de lo que preguntas a tus asistentes, pero Revel te pone fácil reducirlo al mínimo.'
		},
		{
			question: '¿Vendéis los datos de las personas asistentes?',
			answer:
				'No. En la versión alojada cobramos una comisión sobre las transacciones online de pago (1,5 % + 0,25 €). No hay negocio publicitario ni acuerdos con datos.'
		},
		{
			question: '¿Qué datos recopila Revel?',
			answer:
				'Los datos de tu cuenta, los eventos que organizas o a los que asistes, entradas y pagos, y lo que quien organiza pregunte en un cuestionario. No rastreamos tu navegación por otros sitios ni creamos perfiles publicitarios.'
		},
		{
			question: '¿Intervienen terceros?',
			answer:
				'Solo cuando hace falta. Stripe procesa los pagos con tarjeta, el mapa del lugar se carga desde el proveedor de mapas cuando un evento muestra uno, y Apple o Google intervienen cuando alguien añade un pase a su wallet. No hay servicios de analítica ni de publicidad.'
		},
		{
			question: '¿Puedo tener todos los datos en mis propios servidores?',
			answer:
				'Sí. Autoaloja Revel con licencia MIT y todo lo que Revel guarda vive en tu propia base de datos, donde tú la ejecutes. Los datos solo salen de ahí si activas un servicio externo, como Stripe para los pagos en línea.'
		}
	],
	relatedPages: ['self-hosted-event-platform', 'queer-event-management']
};

export const privacyFocusedEventsPT: LandingPageContent = {
	slug: 'privacy-focused-events',
	locale: 'pt',
	meta: {
		title: 'Plataforma de eventos com a privacidade em primeiro lugar, feita para o RGPD | Revel',
		description:
			'Gestão de eventos sem rastreadores nem anúncios. Só cookies essenciais, exportação de dados e eliminação de conta integradas, alojamento na Europa e código aberto para poderes confirmar.',
		keywords:
			'plataforma de eventos rgpd, eventos com privacidade, gestão de eventos sem rastreio, software de eventos europeu, proteção de dados em eventos, bilheteira sem rastreadores'
	},
	hero: {
		headline: 'Eventos sem vigilância',
		subheadline:
			'Sem anúncios, sem rastreadores de analítica, sem venda da tua lista de participantes. Só as ferramentas de que precisas para organizar os teus eventos.'
	},
	intro: {
		paragraphs: [
			'Muitas plataformas de eventos ganham parte do seu dinheiro com o que sabem sobre as pessoas participantes. É por isso que as páginas delas vêm cheias de píxeis de rastreio e as políticas de privacidade se estendem por páginas e páginas.',
			'A Revel não funciona assim. Não há nenhum script de analítica no site, só cookies essenciais, e até os tipos de letra vêm dos nossos próprios servidores. Ganhamos dinheiro com uma pequena comissão sobre bilhetes pagos, não com dados, por isso não temos nada a ganhar em recolher mais.',
			'O código é aberto, por isso não precisas de acreditar na nossa palavra. E se quiseres os dados no teu próprio hardware, podes autoalojar.'
		]
	},
	features: [
		{
			icon: 'shield',
			title: 'Sem scripts de rastreio',
			description:
				'Sem Google Analytics, sem píxeis de publicidade, sem SDKs de terceiros a seguir as pessoas participantes pela web fora.'
		},
		{
			icon: 'eye',
			title: 'Tu decides o que as pessoas convidadas veem',
			description:
				'Escolhe em cada evento se a lista de participantes, o número de participantes e a morada ficam visíveis, e para quem. Quem participa também se pode esconder das listas.'
		},
		{
			icon: 'lock',
			title: 'Pede só o que precisas',
			description:
				'Pronomes, uma foto de perfil ou respostas a um questionário só são pedidos quando o teu evento precisa mesmo deles.'
		},
		{
			icon: 'check',
			title: 'Exportar e eliminar, já integrado',
			description:
				'Qualquer pessoa pode descarregar os seus dados pessoais ou eliminar a conta nas próprias definições. Sem emails para uma caixa de suporte.'
		},
		{
			icon: 'globe',
			title: 'Alojado na Europa',
			description:
				'A nossa versão alojada corre em servidores europeus, sob a legislação de proteção de dados da UE.'
		},
		{
			icon: 'code',
			title: 'Código aberto e autoalojável',
			description:
				'Lê exatamente como os dados são tratados, ou corre a Revel no teu próprio servidor para que nunca saiam das tuas mãos.'
		}
	],
	benefits: {
		title: 'Uma privacidade que consegues explicar à tua comunidade',
		items: [
			'Sem negócio de publicidade, logo sem razões para recolher mais do que precisamos',
			'Só cookies essenciais',
			'Visibilidade da lista de participantes e da morada definida por evento',
			'Autenticação de dois fatores para todas as contas',
			'Exportação de dados e eliminação de conta sem abrir um pedido de suporte',
			'Autoalojamento para quando os dados têm de ficar nos teus próprios servidores'
		]
	},
	cta: {
		title: 'Organiza eventos em que as pessoas participantes podem confiar',
		description: 'Dá uma volta pela demo, ou lê o código por ti.',
		buttons: [
			{
				text: 'Experimentar a demo ao vivo',
				href: 'https://demo.letsrevel.io',
				variant: 'primary'
			},
			{ text: 'Autoalojar (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Contacta-nos', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'A Revel ajuda com o RGPD?',
			answer:
				'Foi pensada com isso em mente. Recolhemos o necessário para gerir eventos, quem participa pode exportar ou eliminar os seus dados de forma autónoma, e a versão alojada corre na Europa. Continuas a ser responsável pelo que perguntas às pessoas participantes, mas a Revel facilita reduzir isso ao mínimo.'
		},
		{
			question: 'Vendem os dados das pessoas participantes?',
			answer:
				'Não. Na versão alojada cobramos uma comissão sobre transações online pagas (1,5 % + 0,25 €). Não há negócio de publicidade nem acordos com dados.'
		},
		{
			question: 'Que dados recolhe a Revel?',
			answer:
				'Os dados da tua conta, os eventos que organizas ou em que participas, bilhetes e pagamentos, e o que quem organiza perguntar num questionário. Não seguimos a tua navegação noutros sites nem criamos perfis de publicidade.'
		},
		{
			question: 'Há terceiros envolvidos?',
			answer:
				'Só quando é preciso. A Stripe processa os pagamentos com cartão, o mapa do local é carregado a partir do fornecedor de mapas quando um evento mostra um, e a Apple ou a Google entram em cena quando alguém adiciona um passe à sua wallet. Não há serviços de analítica nem de publicidade.'
		},
		{
			question: 'Posso manter todos os dados nos meus próprios servidores?',
			answer:
				'Sim. Autoaloja a Revel com a licença MIT e tudo o que a Revel guarda fica na tua própria base de dados, onde quer que a corras. Os dados só saem de lá se ativares um serviço externo, como a Stripe para pagamentos online.'
		}
	],
	relatedPages: ['self-hosted-event-platform', 'queer-event-management']
};
