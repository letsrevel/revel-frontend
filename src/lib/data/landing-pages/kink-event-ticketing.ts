import type { LandingPageContent } from './types';

export const kinkEventTicketingEN: LandingPageContent = {
	slug: 'kink-event-ticketing',
	locale: 'en',
	meta: {
		title: 'Kink & BDSM Event Ticketing, Private and Discreet | Revel',
		description:
			"Ticketing for kink, BDSM and sex-positive events. Vet attendees, keep addresses and guest lists private, and block people who aren't welcome. Open source and self-hostable.",
		keywords:
			'bdsm event ticketing, kink event management, sex positive events, fetish party ticketing, play party tickets, adult event platform'
	},
	hero: {
		headline: 'Discreet Ticketing for Kink Events',
		subheadline: 'Vet your attendees, keep the address quiet, and hold on to your own data.'
	},
	intro: {
		paragraphs: [
			"Running a play party or a munch means juggling consent, trust and discretion on top of the usual ticketing work. Most event platforms weren't built for that, and some have content rules that put events like yours at risk.",
			'Revel was made by people who organize these events. Put a questionnaire in front of your tickets, so newcomers can tell you who vouches for them before they learn where the venue is. Show the address only to confirmed guests. Keep the guest list to yourself.',
			"It's open source, so you can run it on your own server if you want nobody else near your data. Or use our hosted version, which runs in Europe."
		]
	},
	features: [
		{
			icon: 'clipboard',
			title: 'Attendee Vetting',
			description:
				'A questionnaire before the ticket: references, experience, agreement to your consent policy. Approve by hand, or let multiple-choice answers score automatically.'
		},
		{
			icon: 'eye',
			title: 'Address on a Need-to-Know Basis',
			description:
				'Choose who sees the address and the guest list for each event. Attendees can also hide themselves from lists.'
		},
		{
			icon: 'shield',
			title: 'Blocklist',
			description:
				"Keep out people who aren't welcome. Entries match on email, phone or Telegram, and also catch spelling variations of names."
		},
		{
			icon: 'lock',
			title: 'Invite-Only and Members-Only',
			description:
				'Private events, unlisted links and members-only nights. Direct invitations can let people you already trust skip the questionnaire.'
		},
		{
			icon: 'ticket',
			title: 'Proper Ticketing',
			description:
				'Tiers, pay-what-you-can, waitlists, QR check-in at the door, and tickets in Apple Wallet or Google Wallet.'
		},
		{
			icon: 'heart',
			title: 'Potluck Boards',
			description:
				'Snacks, drinks, supplies and safer sex supplies. Guests claim what they bring, so you end up with lube and not six bags of crisps.'
		}
	],
	benefits: {
		title: 'Why Kink Organizers Use Revel',
		items: [
			'Vet newcomers before they get a ticket',
			'Addresses and guest lists stay private',
			"A blocklist for people who aren't welcome",
			'No ads or trackers following your guests around',
			'Self-host for full control over sensitive data',
			'Made by people who run these events'
		]
	},
	cta: {
		title: 'Events That Respect Privacy and Consent',
		description: 'See how it works in the demo, or run it on your own server.',
		buttons: [
			{ text: 'Try the Live Demo', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Self-Host (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Contact Us', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'How does attendee vetting work?',
			answer:
				'You write a questionnaire with the questions that matter to you: experience, references, agreement to your consent policy. People fill it in before they can get a ticket. You choose how submissions are handled: review each one yourself, let passing multiple-choice answers through automatically, or score them automatically and still check each one before anyone gets in.'
		},
		{
			question: 'Can I keep the address secret until someone is confirmed?',
			answer:
				"Yes. For each event you choose who can see the address, so it stays hidden from anyone who isn't attending."
		},
		{
			question: 'Can I keep my events completely private?',
			answer:
				'Yes. Events can be private and invite-only, members-only, or unlisted. Direct invitations can let trusted guests skip the questionnaire or the membership requirement.'
		},
		{
			question: 'Will my events get taken down?',
			answer:
				"We don't restrict adult or kink events, and we openly support sex-positive communities. If you self-host, nobody but you decides what runs on it."
		},
		{
			question: 'What if I need maximum privacy?',
			answer:
				"Self-host Revel on your own server. It's MIT licensed and free, so you only pay for hosting and, if you sell tickets online, Stripe's fees."
		}
	],
	relatedPages: ['queer-event-management', 'privacy-focused-events', 'self-hosted-event-platform']
};

export const kinkEventTicketingDE: LandingPageContent = {
	slug: 'kink-event-ticketing',
	locale: 'de',
	meta: {
		title: 'Ticketing für Kink- und BDSM-Events, privat und diskret | Revel',
		description:
			'Ticketing für Kink-, BDSM- und sex-positive Events. Prüfe Teilnehmer*innen vorab, halte Adressen und Gästelisten privat und sperre Leute aus, die nicht willkommen sind. Open Source und selbst hostbar.',
		keywords:
			'bdsm event ticketing, kink events organisieren, sex positive events, fetisch party tickets, play party tickets, ticketing für adult events'
	},
	hero: {
		headline: 'Diskretes Ticketing für Kink-Events',
		subheadline:
			'Prüfe deine Gäste vorab, halte die Adresse unter Verschluss und behalte deine Daten bei dir.'
	},
	intro: {
		paragraphs: [
			'Wer eine Play-Party oder einen Munch organisiert, jongliert neben dem üblichen Ticketing auch mit Konsens, Vertrauen und Diskretion. Die meisten Event-Plattformen sind dafür nicht gebaut, und manche haben Inhaltsregeln, die Events wie deine gefährden.',
			'Revel kommt von Leuten, die solche Events selbst organisieren. Stell einen Fragebogen vor deine Tickets, damit Neue dir sagen können, wer für sie bürgt, bevor sie erfahren, wo die Location ist. Zeig die Adresse nur bestätigten Gästen. Behalte die Gästeliste für dich.',
			'Revel ist Open Source, du kannst es also auf deinem eigenen Server betreiben, wenn niemand sonst in die Nähe deiner Daten kommen soll. Oder du nutzt unsere gehostete Version, die in Europa läuft.'
		]
	},
	features: [
		{
			icon: 'clipboard',
			title: 'Teilnehmer*innen-Screening',
			description:
				'Ein Fragebogen vor dem Ticket: Referenzen, Erfahrung, Zustimmung zu deiner Konsens-Policy. Genehmige von Hand oder lass Multiple-Choice-Antworten automatisch bewerten.'
		},
		{
			icon: 'eye',
			title: 'Adresse nur für Eingeweihte',
			description:
				'Leg für jedes Event fest, wer die Adresse und die Gästeliste sieht. Teilnehmer*innen können sich außerdem selbst in Listen ausblenden.'
		},
		{
			icon: 'shield',
			title: 'Sperrliste',
			description:
				'Halte Leute fern, die nicht willkommen sind. Einträge greifen bei E-Mail, Telefonnummer oder Telegram und erkennen auch abweichende Schreibweisen von Namen.'
		},
		{
			icon: 'lock',
			title: 'Nur mit Einladung, nur für Mitglieder',
			description:
				'Private Events, nicht gelistete Links und Abende nur für Mitglieder. Mit direkten Einladungen können Leute, denen du schon vertraust, den Fragebogen überspringen.'
		},
		{
			icon: 'ticket',
			title: 'Richtiges Ticketing',
			description:
				'Ticketstufen, Zahl-was-du-kannst-Preise, Wartelisten, QR-Check-in am Eingang und Tickets in Apple Wallet oder Google Wallet.'
		},
		{
			icon: 'heart',
			title: 'Potluck-Listen',
			description:
				'Snacks, Getränke, Zubehör und Safer-Sex-Material. Gäste tragen ein, was sie mitbringen, damit du am Ende Gleitgel hast und nicht sechs Tüten Chips.'
		}
	],
	benefits: {
		title: 'Warum Kink-Veranstalter*innen Revel nutzen',
		items: [
			'Neue prüfen, bevor sie ein Ticket bekommen',
			'Adressen und Gästelisten bleiben privat',
			'Eine Sperrliste für Leute, die nicht willkommen sind',
			'Keine Werbung und keine Tracker, die deinen Gästen hinterherlaufen',
			'Selbst hosten für volle Kontrolle über sensible Daten',
			'Gemacht von Leuten, die solche Events selbst veranstalten'
		]
	},
	cta: {
		title: 'Events, die Privatsphäre und Konsens respektieren',
		description:
			'Schau dir in der Demo an, wie es funktioniert, oder betreib es auf deinem eigenen Server.',
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
			question: 'Wie funktioniert das Screening der Teilnehmer*innen?',
			answer:
				'Du schreibst einen Fragebogen mit den Fragen, die dir wichtig sind: Erfahrung, Referenzen, Zustimmung zu deiner Konsens-Policy. Die Leute füllen ihn aus, bevor sie ein Ticket bekommen können. Du entscheidest, wie Einreichungen behandelt werden: jede selbst prüfen, bestandene Multiple-Choice-Antworten automatisch durchlassen oder automatisch bewerten und trotzdem jede prüfen, bevor jemand reinkommt.'
		},
		{
			question: 'Kann ich die Adresse geheim halten, bis jemand bestätigt ist?',
			answer:
				'Ja. Du legst für jedes Event fest, wer die Adresse sehen kann, sodass sie vor allen verborgen bleibt, die nicht teilnehmen.'
		},
		{
			question: 'Kann ich meine Events komplett privat halten?',
			answer:
				'Ja. Events können privat und nur mit Einladung, nur für Mitglieder oder nicht gelistet sein. Mit direkten Einladungen können vertrauenswürdige Gäste den Fragebogen oder die Mitgliedschaftspflicht überspringen.'
		},
		{
			question: 'Werden meine Events gelöscht?',
			answer:
				'Wir schränken Adult- oder Kink-Events nicht ein und unterstützen sex-positive Communities ganz offen. Wenn du selbst hostest, entscheidet niemand außer dir, was darauf läuft.'
		},
		{
			question: 'Was, wenn ich maximale Privatsphäre brauche?',
			answer:
				'Hoste Revel auf deinem eigenen Server. Es ist MIT-lizenziert und kostenlos, du zahlst also nur fürs Hosting und, wenn du Tickets online verkaufst, die Gebühren von Stripe.'
		}
	],
	relatedPages: ['queer-event-management', 'privacy-focused-events', 'self-hosted-event-platform']
};

export const kinkEventTicketingIT: LandingPageContent = {
	slug: 'kink-event-ticketing',
	locale: 'it',
	meta: {
		title: 'Ticketing per eventi kink e BDSM, privato e discreto | Revel',
		description:
			'Ticketing per eventi kink, BDSM e sex-positive. Valuta chi partecipa, tieni privati indirizzi e liste ospiti e blocca le persone non gradite. Open source e self-hostable.',
		keywords:
			'biglietti eventi bdsm, organizzare eventi kink, eventi sex positive, biglietti feste fetish, biglietti play party, piattaforma eventi per adulti'
	},
	hero: {
		headline: 'Ticketing discreto per eventi kink',
		subheadline:
			"Valuta le persone che partecipano, tieni riservato l'indirizzo e conserva i tuoi dati."
	},
	intro: {
		paragraphs: [
			'Organizzare una play party o un munch significa gestire consenso, fiducia e discrezione oltre al solito lavoro sui biglietti. Quasi nessuna piattaforma per eventi è pensata per questo, e alcune hanno regole sui contenuti che mettono a rischio eventi come i tuoi.',
			"Revel l'ha creato chi organizza questi eventi. Metti un questionario prima dei biglietti, così le persone nuove possono dirti chi garantisce per loro prima di sapere dove si trova la location. Mostra l'indirizzo solo a chi ha ricevuto la conferma. Tieni la lista ospiti per te.",
			'È open source, quindi puoi farlo girare sul tuo server se non vuoi nessun altro vicino ai tuoi dati. Oppure usa la nostra versione hosted, che gira in Europa.'
		]
	},
	features: [
		{
			icon: 'clipboard',
			title: 'Valutazione di chi partecipa',
			description:
				'Un questionario prima del biglietto: referenze, esperienza, adesione alla tua policy sul consenso. Approva a mano, oppure lascia che le risposte a scelta multipla ricevano un punteggio in automatico.'
		},
		{
			icon: 'eye',
			title: "L'indirizzo solo a chi serve",
			description:
				"Scegli per ogni evento chi vede l'indirizzo e la lista ospiti. Chi partecipa può anche nascondersi dalle liste."
		},
		{
			icon: 'shield',
			title: 'Blacklist',
			description:
				'Tieni fuori le persone non gradite. Le voci corrispondono per email, telefono o Telegram, e riconoscono anche le varianti di scrittura dei nomi.'
		},
		{
			icon: 'lock',
			title: 'Solo su invito e solo per membri',
			description:
				'Eventi privati, link non in elenco e serate riservate ai membri. Con gli inviti diretti, le persone di cui ti fidi già possono saltare il questionario.'
		},
		{
			icon: 'ticket',
			title: 'Un ticketing come si deve',
			description:
				"Livelli di biglietto, paga quanto puoi, liste d'attesa, check-in con QR all'ingresso e biglietti in Apple Wallet o Google Wallet."
		},
		{
			icon: 'heart',
			title: 'Bacheche potluck',
			description:
				'Snack, bevande, materiale vario e articoli per il sesso sicuro. Chi viene segna cosa porta, così ti ritrovi col lubrificante e non con sei buste di patatine.'
		}
	],
	benefits: {
		title: 'Perché chi organizza eventi kink usa Revel',
		items: [
			'Valuta le persone nuove prima che ricevano un biglietto',
			'Indirizzi e liste ospiti restano privati',
			'Una blacklist per le persone non gradite',
			'Niente pubblicità né tracker che seguono chi viene ai tuoi eventi',
			'Self-hosting per il pieno controllo sui dati sensibili',
			'Creato da chi organizza questi eventi'
		]
	},
	cta: {
		title: 'Eventi che rispettano privacy e consenso',
		description: 'Guarda come funziona nella demo, oppure fallo girare sul tuo server.',
		buttons: [
			{ text: 'Prova la demo live', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Self-host (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Contattaci', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Come funziona la valutazione di chi partecipa?',
			answer:
				'Scrivi un questionario con le domande che contano per te: esperienza, referenze, adesione alla tua policy sul consenso. Le persone lo compilano prima di poter ricevere un biglietto. Scegli tu come gestire le risposte: valutarle una per una, far passare in automatico chi supera le domande a scelta multipla, oppure assegnare un punteggio automatico e controllarle comunque tutte prima di far entrare qualcuno.'
		},
		{
			question: "Posso tenere segreto l'indirizzo finché una persona non riceve la conferma?",
			answer:
				"Sì. Per ogni evento scegli chi può vedere l'indirizzo, così resta nascosto a chiunque non partecipi."
		},
		{
			question: 'Posso tenere i miei eventi completamente privati?',
			answer:
				'Sì. Gli eventi possono essere privati e solo su invito, riservati ai membri oppure non in elenco. Con gli inviti diretti, le persone di fiducia possono saltare il questionario o il requisito di membership.'
		},
		{
			question: 'I miei eventi verranno rimossi?',
			answer:
				'Non limitiamo gli eventi per adulti o kink, e sosteniamo apertamente le community sex-positive. Se fai self-hosting, nessuno tranne te decide cosa ci gira sopra.'
		},
		{
			question: 'E se mi serve la massima privacy?',
			answer:
				"Installa Revel sul tuo server. Ha licenza MIT ed è gratuito, quindi paghi solo l'hosting e, se vendi biglietti online, le commissioni di Stripe."
		}
	],
	relatedPages: ['queer-event-management', 'privacy-focused-events', 'self-hosted-event-platform']
};

export const kinkEventTicketingFR: LandingPageContent = {
	slug: 'kink-event-ticketing',
	locale: 'fr',
	meta: {
		title: 'Billetterie pour événements kink et BDSM, privée et discrète | Revel',
		description:
			"Billetterie pour événements kink, BDSM et sex-positifs. Filtre les personnes qui s'inscrivent, garde les adresses et la liste des participant·es privées, et bloque les personnes indésirables. Open source et auto-hébergeable.",
		keywords:
			'billetterie soirée bdsm, organiser un événement kink, événements sex positifs, billetterie soirée fétichiste, billets play party, plateforme événements adultes'
	},
	hero: {
		headline: 'Une billetterie discrète pour les événements kink',
		subheadline:
			"Filtre tes participant·es, garde l'adresse pour toi et garde la main sur tes données."
	},
	intro: {
		paragraphs: [
			"Organiser une play party ou un munch, c'est gérer le consentement, la confiance et la discrétion en plus du travail habituel de billetterie. La plupart des plateformes d'événements n'ont pas été conçues pour ça, et certaines ont des règles de contenu qui mettent en danger des événements comme les tiens.",
			"Revel a été créé par des personnes qui organisent ce genre d'événements. Place un questionnaire avant tes billets, pour que les nouvelles personnes puissent te dire qui peut répondre d'elles avant de savoir où se trouve le lieu. Montre l'adresse uniquement aux personnes confirmées. Garde la liste des participant·es pour toi.",
			"C'est open source : tu peux donc le faire tourner sur ton propre serveur si tu ne veux personne d'autre près de tes données. Ou utiliser notre version hébergée, qui tourne en Europe."
		]
	},
	features: [
		{
			icon: 'clipboard',
			title: 'Filtrage des participant·es',
			description:
				'Un questionnaire avant le billet : références, expérience, adhésion à ta politique de consentement. Valide à la main, ou laisse les réponses à choix multiples être notées automatiquement.'
		},
		{
			icon: 'eye',
			title: "L'adresse, seulement pour qui doit savoir",
			description:
				"Choisis pour chaque événement qui voit l'adresse et la liste des participant·es. Chaque personne peut aussi se masquer des listes."
		},
		{
			icon: 'shield',
			title: 'Liste noire',
			description:
				"Tiens à l'écart les personnes indésirables. Les entrées se basent sur l'e-mail, le téléphone ou Telegram, et repèrent aussi les variantes d'orthographe des noms."
		},
		{
			icon: 'lock',
			title: 'Sur invitation et réservé aux membres',
			description:
				'Événements privés, liens non répertoriés et soirées réservées aux membres. Les invitations directes permettent aux personnes en qui tu as déjà confiance de sauter le questionnaire.'
		},
		{
			icon: 'ticket',
			title: 'Une vraie billetterie',
			description:
				"Niveaux de billets, prix libre, listes d'attente, check-in par QR code à l'entrée et billets dans Apple Wallet ou Google Wallet."
		},
		{
			icon: 'heart',
			title: 'Tableaux potluck',
			description:
				"Snacks, boissons, fournitures et matériel pour le safer sex. Chaque personne indique ce qu'elle apporte, et tu te retrouves avec du lubrifiant plutôt qu'avec six paquets de chips."
		}
	],
	benefits: {
		title: 'Pourquoi les organisateur·rices kink utilisent Revel',
		items: [
			"Filtrer les nouvelles personnes avant qu'elles aient un billet",
			'Les adresses et les listes de participant·es restent privées',
			'Une liste noire pour les personnes indésirables',
			'Aucune pub ni aucun traqueur qui suit les personnes que tu invites',
			'Auto-héberger pour une maîtrise totale des données sensibles',
			'Conçu par des personnes qui organisent ces événements'
		]
	},
	cta: {
		title: 'Des événements qui respectent la vie privée et le consentement',
		description:
			'Découvre comment ça marche dans la démo, ou fais-le tourner sur ton propre serveur.',
		buttons: [
			{ text: 'Tester la démo en ligne', href: 'https://demo.letsrevel.io', variant: 'primary' },
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
			question: 'Comment fonctionne le filtrage des participant·es ?',
			answer:
				'Tu rédiges un questionnaire avec les questions qui comptent pour toi : expérience, références, adhésion à ta politique de consentement. Les personnes le remplissent avant de pouvoir obtenir un billet. Tu choisis comment traiter les candidatures : les examiner une par une, laisser passer automatiquement les réponses à choix multiples réussies, ou les noter automatiquement et quand même vérifier chacune avant que quiconque n’entre.'
		},
		{
			question: "Puis-je garder l'adresse secrète jusqu'à ce qu'une personne soit confirmée ?",
			answer:
				"Oui. Pour chaque événement, tu choisis qui peut voir l'adresse : elle reste donc cachée à toute personne qui ne participe pas."
		},
		{
			question: 'Puis-je garder mes événements entièrement privés ?',
			answer:
				"Oui. Les événements peuvent être privés et sur invitation, réservés aux membres ou non répertoriés. Les invitations directes permettent aux personnes de confiance de sauter le questionnaire ou la condition d'adhésion."
		},
		{
			question: "Mes événements risquent-ils d'être supprimés ?",
			answer:
				"Nous ne restreignons pas les événements pour adultes ou kink, et nous soutenons ouvertement les communautés sex-positives. Si tu auto-héberges, personne d'autre que toi ne décide de ce qui tourne dessus."
		},
		{
			question: "Et si j'ai besoin d'une confidentialité maximale ?",
			answer:
				"Auto-héberge Revel sur ton propre serveur. Il est sous licence MIT et gratuit : tu ne paies que l'hébergement et, si tu vends des billets en ligne, les frais de Stripe."
		}
	],
	relatedPages: ['queer-event-management', 'privacy-focused-events', 'self-hosted-event-platform']
};

export const kinkEventTicketingES: LandingPageContent = {
	slug: 'kink-event-ticketing',
	locale: 'es',
	meta: {
		title: 'Entradas para eventos kink y BDSM, privadas y discretas | Revel',
		description:
			'Venta de entradas para eventos kink, BDSM y sex-positive. Filtra a quienes asisten, mantén en privado las direcciones y las listas de asistencia, y bloquea a las personas que no son bienvenidas. Código abierto y autoalojable.',
		keywords:
			'entradas eventos bdsm, organizar eventos kink, eventos sex positive, entradas fiestas fetish, entradas play party, plataforma eventos para adultos'
	},
	hero: {
		headline: 'Entradas discretas para eventos kink',
		subheadline:
			'Filtra a quienes asisten, no divulgues la dirección y quédate con tus propios datos.'
	},
	intro: {
		paragraphs: [
			'Organizar una play party o un munch supone manejar consentimiento, confianza y discreción, además del trabajo habitual de venta de entradas. La mayoría de las plataformas de eventos no se hicieron para eso, y algunas tienen normas de contenido que ponen en riesgo eventos como los tuyos.',
			'Revel lo han creado personas que organizan este tipo de eventos. Pon un cuestionario delante de tus entradas, para que las personas nuevas te digan quién responde por ellas antes de saber dónde está el local. Muestra la dirección solo a las personas confirmadas. Y la lista de asistencia, para ti.',
			'Es de código abierto, así que puedes montarlo en tu propio servidor si no quieres a nadie más cerca de tus datos. O usa nuestra versión alojada, que funciona en Europa.'
		]
	},
	features: [
		{
			icon: 'clipboard',
			title: 'Selección de participantes',
			description:
				'Un cuestionario antes de la entrada: referencias, experiencia, aceptación de tu política de consentimiento. Aprueba a mano, o deja que las respuestas de opción múltiple se puntúen automáticamente.'
		},
		{
			icon: 'eye',
			title: 'La dirección, solo para quien la necesite',
			description:
				'Elige en cada evento quién ve la dirección y la lista de asistencia. Quienes asisten también pueden ocultarse de las listas.'
		},
		{
			icon: 'shield',
			title: 'Lista negra',
			description:
				'Deja fuera a las personas que no son bienvenidas. Los registros coinciden por email, teléfono o Telegram, y detectan también variaciones en cómo se escriben los nombres.'
		},
		{
			icon: 'lock',
			title: 'Solo por invitación y solo para miembros',
			description:
				'Eventos privados, enlaces no listados y noches solo para miembros. Con las invitaciones directas, las personas en quienes ya confías pueden saltarse el cuestionario.'
		},
		{
			icon: 'ticket',
			title: 'Venta de entradas en serio',
			description:
				'Niveles de entrada, paga lo que puedas, listas de espera, check-in con QR en la puerta y entradas en Apple Wallet o Google Wallet.'
		},
		{
			icon: 'heart',
			title: 'Tablones de potluck',
			description:
				'Snacks, bebidas, material y artículos para sexo seguro. Cada persona apunta lo que trae, así acabas con lubricante y no con seis bolsas de patatas fritas.'
		}
	],
	benefits: {
		title: 'Por qué quienes organizan eventos kink usan Revel',
		items: [
			'Filtra a las personas nuevas antes de que consigan entrada',
			'Las direcciones y las listas de asistencia siguen siendo privadas',
			'Una lista negra para las personas que no son bienvenidas',
			'Sin anuncios ni rastreadores persiguiendo a quienes asisten a tus eventos',
			'Autoalójate para tener control total sobre los datos sensibles',
			'Creado por personas que organizan estos eventos'
		]
	},
	cta: {
		title: 'Eventos que respetan la privacidad y el consentimiento',
		description: 'Mira cómo funciona en la demo, o móntalo en tu propio servidor.',
		buttons: [
			{ text: 'Probar la demo en vivo', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Autoalojar (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Contáctanos', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: '¿Cómo funciona la selección de participantes?',
			answer:
				'Escribes un cuestionario con las preguntas que te importan: experiencia, referencias, aceptación de tu política de consentimiento. La gente lo rellena antes de poder conseguir una entrada. Tú decides cómo se gestionan las solicitudes: revisar cada una, dejar pasar automáticamente las respuestas de opción múltiple que aprueban, o puntuarlas automáticamente y revisar igualmente cada una antes de que nadie entre.'
		},
		{
			question: '¿Puedo mantener la dirección en secreto hasta que se confirme la asistencia?',
			answer:
				'Sí. En cada evento eliges quién puede ver la dirección, así que queda oculta para cualquier persona que no asista.'
		},
		{
			question: '¿Puedo mantener mis eventos completamente privados?',
			answer:
				'Sí. Los eventos pueden ser privados y solo por invitación, solo para miembros o no listados. Con las invitaciones directas, las personas de confianza pueden saltarse el cuestionario o el requisito de membresía.'
		},
		{
			question: '¿Me van a retirar los eventos?',
			answer:
				'No restringimos los eventos para adultos ni los eventos kink, y apoyamos abiertamente a las comunidades sex-positive. Si te autoalojas, nadie más que tú decide qué funciona en tu servidor.'
		},
		{
			question: '¿Y si necesito la máxima privacidad?',
			answer:
				'Autoaloja Revel en tu propio servidor. Tiene licencia MIT y es gratuito, así que solo pagas el alojamiento y, si vendes entradas online, las comisiones de Stripe.'
		}
	],
	relatedPages: ['queer-event-management', 'privacy-focused-events', 'self-hosted-event-platform']
};

export const kinkEventTicketingPT: LandingPageContent = {
	slug: 'kink-event-ticketing',
	locale: 'pt',
	meta: {
		title: 'Bilhética para eventos kink e BDSM, privada e discreta | Revel',
		description:
			'Bilhética para eventos kink, BDSM e sex-positive. Avalia quem se inscreve, mantém as moradas e as listas de presenças privadas e bloqueia as pessoas que não são bem-vindas. Código aberto e autoalojável.',
		keywords:
			'bilhetes eventos bdsm, organizar eventos kink, eventos sex positive, bilhetes festas fetichistas, bilhetes play party, plataforma eventos para adultos'
	},
	hero: {
		headline: 'Bilhética discreta para eventos kink',
		subheadline:
			'Avalia as pessoas que participam, guarda a morada para ti e fica com os teus próprios dados.'
	},
	intro: {
		paragraphs: [
			'Organizar uma play party ou um munch implica gerir consentimento, confiança e discrição, além do trabalho habitual de bilhética. A maioria das plataformas de eventos não foi feita para isso, e algumas têm regras de conteúdo que põem em risco eventos como os teus.',
			'A Revel foi criada por pessoas que organizam estes eventos. Põe um questionário antes dos bilhetes, para que as pessoas novas te digam quem responde por elas antes de saberem onde fica o espaço. Mostra a morada só às pessoas confirmadas. Guarda a lista de presenças para ti.',
			'É de código aberto, por isso podes corrê-la no teu próprio servidor se não quiseres mais ninguém perto dos teus dados. Ou usa a nossa versão alojada, que corre na Europa.'
		]
	},
	features: [
		{
			icon: 'clipboard',
			title: 'Seleção de participantes',
			description:
				'Um questionário antes do bilhete: referências, experiência, aceitação da tua política de consentimento. Aprova à mão, ou deixa que as respostas de escolha múltipla sejam pontuadas automaticamente.'
		},
		{
			icon: 'eye',
			title: 'A morada, só para quem precisa de saber',
			description:
				'Escolhe, para cada evento, quem vê a morada e a lista de presenças. As pessoas participantes também se podem esconder das listas.'
		},
		{
			icon: 'shield',
			title: 'Lista negra',
			description:
				'Mantém afastadas as pessoas que não são bem-vindas. Os registos correspondem por email, telefone ou Telegram, e apanham também variações na forma como os nomes se escrevem.'
		},
		{
			icon: 'lock',
			title: 'Só por convite e só para membros',
			description:
				'Eventos privados, links não listados e noites só para membros. Com convites diretos, as pessoas em quem já confias podem saltar o questionário.'
		},
		{
			icon: 'ticket',
			title: 'Bilhética a sério',
			description:
				'Níveis de bilhete, paga o que puderes, listas de espera, check-in por QR à entrada e bilhetes na Apple Wallet ou na Google Wallet.'
		},
		{
			icon: 'heart',
			title: 'Quadros de potluck',
			description:
				'Snacks, bebidas, material e artigos para sexo seguro. Cada pessoa indica o que leva, e acabas com lubrificante em vez de seis pacotes de batatas fritas.'
		}
	],
	benefits: {
		title: 'Porque é que quem organiza eventos kink usa a Revel',
		items: [
			'Avalia as pessoas novas antes de terem bilhete',
			'Moradas e listas de presenças ficam privadas',
			'Uma lista negra para as pessoas que não são bem-vindas',
			'Sem anúncios nem rastreadores atrás de quem vai aos teus eventos',
			'Autoaloja para teres controlo total sobre dados sensíveis',
			'Criada por pessoas que organizam estes eventos'
		]
	},
	cta: {
		title: 'Eventos que respeitam a privacidade e o consentimento',
		description: 'Vê como funciona na demo, ou corre-a no teu próprio servidor.',
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
			question: 'Como funciona a seleção de participantes?',
			answer:
				'Escreves um questionário com as perguntas que te importam: experiência, referências, aceitação da tua política de consentimento. As pessoas preenchem-no antes de poderem obter um bilhete. Tu decides como tratar as candidaturas: rever cada uma, deixar passar automaticamente as respostas de escolha múltipla aprovadas, ou pontuá-las automaticamente e ainda assim verificar cada uma antes de alguém entrar.'
		},
		{
			question: 'Posso manter a morada secreta até a pessoa estar confirmada?',
			answer:
				'Sim. Em cada evento escolhes quem pode ver a morada, por isso fica escondida de qualquer pessoa que não vá participar.'
		},
		{
			question: 'Posso manter os meus eventos totalmente privados?',
			answer:
				'Sim. Os eventos podem ser privados e só por convite, só para membros ou não listados. Com convites diretos, as pessoas de confiança podem saltar o questionário ou o requisito de adesão.'
		},
		{
			question: 'Os meus eventos vão ser removidos?',
			answer:
				'Não restringimos eventos para adultos nem eventos kink, e apoiamos abertamente as comunidades sex-positive. Se te autoalojares, ninguém além de ti decide o que corre lá.'
		},
		{
			question: 'E se precisar de privacidade máxima?',
			answer:
				'Autoaloja a Revel no teu próprio servidor. Tem licença MIT e é gratuita, por isso só pagas o alojamento e, se venderes bilhetes online, as taxas da Stripe.'
		}
	],
	relatedPages: ['queer-event-management', 'privacy-focused-events', 'self-hosted-event-platform']
};
