import type { LandingPageContent } from './types';

export const clubMembershipManagementEN: LandingPageContent = {
	slug: 'club-membership-management',
	locale: 'en',
	meta: {
		title: 'Club Membership Management: Memberships, Classes and Passes | Revel',
		description:
			'Open-source membership software for gyms, yoga studios, dance schools, sports clubs and choirs. Monthly, annual or lifetime plans, members-only classes, class passes and wallet membership cards.',
		keywords:
			'club membership management, membership management software, gym membership software, yoga studio membership, sports club management, class booking with memberships, members-only events, digital membership card'
	},
	hero: {
		headline: 'Run a Club, Not a Spreadsheet',
		subheadline:
			'Memberships, members-only classes, series passes and wallet cards in one open-source platform. It works for a gym with 50 members and for a choir with 500.'
	},
	intro: {
		paragraphs: [
			'Picture a gym with fifty members that runs a weekly class for ten people. Today that means a membership spreadsheet, a WhatsApp group for sign-ups, a payment reminder every month, and a laminated card nobody carries. Revel replaces all of it.',
			'Members pay monthly, yearly, or once for a lifetime membership. The weekly class is a members-only event: members RSVP until the ten spots are gone, and if you turn on the waitlist, latecomers can queue for a cancellation. Prefer class packs? Sell a pass for the whole series and every session is covered. The membership card sits in Apple Wallet or Google Wallet, so checking people in is a quick scan.',
			'It works the same way for a yoga studio, a dance school, a climbing club, a rowing club or a choir. Revel is open source and free for free events, so you pay nothing until you actually charge for something.'
		]
	},
	features: [
		{
			icon: 'users',
			title: 'Membership Tiers and Plans',
			description:
				'Tiers like Member, Student or Family, each with monthly, annual or lifetime plans. Take payments online through Stripe, or run offline plans and record cash and transfers yourself.'
		},
		{
			icon: 'lock',
			title: 'Members-Only Classes',
			description:
				'Make any event members only, and reserve ticket tiers for specific membership tiers. A weekly class for ten is a members-only event with an RSVP and a cap of ten.'
		},
		{
			icon: 'ticket',
			title: 'Series Passes',
			description:
				'Sell one pass for a whole series of sessions, a course or a season. Keep it for members if you like. People who join late pay a pro-rata price automatically.'
		},
		{
			icon: 'heart',
			title: 'Wallet Membership Cards',
			description:
				'Members add their card to Apple Wallet or Google Wallet, or download a PDF. Scan it at the door with the QR scanner, no printed card needed.'
		},
		{
			icon: 'clipboard',
			title: 'Application Questionnaires',
			description:
				'Put a short questionnaire in front of a membership: a waiver, a level check, your code of conduct. Approve by hand, score it automatically, or both.'
		},
		{
			icon: 'check',
			title: 'Self-Service for Members',
			description:
				"Members can pause, cancel or switch plans themselves and update their card through Stripe's billing portal, so you're not chasing payment details."
		}
	],
	benefits: {
		title: 'Why Clubs and Studios Choose Revel',
		items: [
			'Membership payments, class sign-ups and door check-in in one place',
			'Recurring members-only classes with a plain RSVP and a hard cap',
			'Series passes double as class packs, courses and season tickets',
			'Membership cards in Apple Wallet and Google Wallet',
			'Free for free events and offline payments, with a small fee only when we process a payment online',
			'No ads, no trackers, and your member list stays yours'
		]
	},
	cta: {
		title: 'Ready to Retire the Spreadsheet?',
		description: 'Set up your club in minutes, or try the demo first. No credit card needed.',
		buttons: [
			{ text: 'Try the Live Demo', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Create Your Club', href: '/register', variant: 'secondary' },
			{ text: 'Contact Us', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'How does a weekly members-only class work?',
			answer:
				"Create the class as a recurring series, make it members only and set the capacity to ten. Members RSVP from the event page. Once the ten spots are taken the class is full, and if you've switched on the waitlist, others can join it and get offered a spot when someone drops out. No tickets, no payments, nothing to reconcile."
		},
		{
			question: 'Can I sell a class pack or a course instead of single sessions?',
			answer:
				'Yes. A series pass covers every event in a series, whether that is a ten-week course, a term or a season. You set the price and decide whether it is members only, and Revel lowers it pro rata for sessions that have already happened.'
		},
		{
			question: 'How do members pay their membership?',
			answer:
				'Each tier can have monthly, annual or lifetime plans. Monthly and annual plans can be paid online through Stripe and renew automatically. For cash, bank transfers or a one-off lifetime fee, set up an offline plan and record the payments yourself in the dashboard, at no cost.'
		},
		{
			question: 'Is there a physical membership card?',
			answer:
				'Every member gets a digital card for Apple Wallet and Google Wallet, plus a PDF to download. At the door, scan the QR code with the Revel check-in scanner to confirm the membership is active.'
		},
		{
			question: 'What does it cost?',
			answer:
				'Nothing for free events, RSVPs and memberships paid offline. When Revel processes an online payment for you, a small fee applies (1.5% + €0.25 per transaction). Self-hosting is free under the MIT license.'
		},
		{
			question: 'Is Revel only for sports clubs?',
			answer:
				'No. The same tools run yoga and pilates studios, dance and music schools, choirs, climbing gyms, rowing and cycling clubs, makerspaces, and any community that combines a membership with recurring sessions.'
		}
	],
	relatedPages: ['community-first-event-platform', 'eventbrite-alternative']
};

export const clubMembershipManagementDE: LandingPageContent = {
	slug: 'club-membership-management',
	locale: 'de',
	meta: {
		title: 'Mitgliederverwaltung für Vereine: Mitgliedschaften, Kurse und Pässe | Revel',
		description:
			'Open-Source-Mitgliederverwaltung für Fitnessstudios, Yogastudios, Tanzschulen, Sportvereine und Chöre. Monats-, Jahres- oder lebenslange Pläne, Kurse nur für Mitglieder, Kurspässe und Mitgliedskarten im Wallet.',
		keywords:
			'mitgliederverwaltung verein, mitgliederverwaltung software, vereinsverwaltung software, fitnessstudio mitgliedschaft software, yogastudio mitgliederverwaltung, sportverein verwaltung, kursbuchung mit mitgliedschaft, events nur für mitglieder, digitale mitgliedskarte'
	},
	hero: {
		headline: 'Führ einen Verein, keine Tabelle',
		subheadline:
			'Mitgliedschaften, Kurse nur für Mitglieder, Serienpässe und Wallet-Karten in einer Open-Source-Plattform. Das klappt beim Fitnessstudio mit 50 Mitgliedern genauso wie beim Chor mit 500.'
	},
	intro: {
		paragraphs: [
			'Stell dir ein Fitnessstudio mit fünfzig Mitgliedern vor, das jede Woche einen Kurs für zehn Leute anbietet. Heute heißt das: eine Mitgliedertabelle, eine WhatsApp-Gruppe für die Anmeldungen, jeden Monat eine Zahlungserinnerung und eine laminierte Karte, die niemand dabeihat. Revel ersetzt das alles.',
			'Mitglieder zahlen monatlich, jährlich oder einmalig für eine lebenslange Mitgliedschaft. Der wöchentliche Kurs ist ein Event nur für Mitglieder: Mitglieder sagen zu, bis die zehn Plätze weg sind, und wenn du die Warteliste einschaltest, können sich Nachzügler*innen für eine Absage anstellen. Lieber Kurspakete? Verkauf einen Pass für die ganze Serie, dann ist jeder Termin abgedeckt. Die Mitgliedskarte liegt in Apple Wallet oder Google Wallet, der Check-in ist also ein kurzer Scan.',
			'Genauso funktioniert es für ein Yogastudio, eine Tanzschule, einen Kletterclub, einen Ruderverein oder einen Chor. Revel ist Open Source und für kostenlose Events gratis, du zahlst also nichts, bis du tatsächlich Geld für etwas verlangst.'
		]
	},
	features: [
		{
			icon: 'users',
			title: 'Mitgliedschaftsstufen und Pläne',
			description:
				'Stufen wie Mitglied, Student*in oder Familie, jede mit Monats-, Jahres- oder lebenslangen Plänen. Nimm Zahlungen online über Stripe an, oder nutze Offline-Pläne und erfasse Bargeld und Überweisungen selbst.'
		},
		{
			icon: 'lock',
			title: 'Kurse nur für Mitglieder',
			description:
				'Mach jedes beliebige Event zum Event nur für Mitglieder und reserviere Ticketstufen für bestimmte Mitgliedschaftsstufen. Ein wöchentlicher Kurs für zehn ist ein Event nur für Mitglieder mit Zusage und maximal zehn Plätzen.'
		},
		{
			icon: 'ticket',
			title: 'Serienpässe',
			description:
				'Verkauf einen Pass für eine ganze Serie von Terminen, einen Kurs oder eine Saison. Wenn du willst, nur für Mitglieder. Wer später einsteigt, zahlt automatisch einen anteiligen Preis.'
		},
		{
			icon: 'heart',
			title: 'Mitgliedskarten im Wallet',
			description:
				'Mitglieder legen ihre Karte in Apple Wallet oder Google Wallet ab oder laden ein PDF herunter. Am Einlass scannst du sie mit dem QR-Scanner, ganz ohne gedruckte Karte.'
		},
		{
			icon: 'clipboard',
			title: 'Fragebögen für die Aufnahme',
			description:
				'Stell einer Mitgliedschaft einen kurzen Fragebogen voran: einen Haftungsausschluss, einen Levelcheck, euren Verhaltenskodex. Gib von Hand frei, lass automatisch bewerten oder kombiniere beides.'
		},
		{
			icon: 'check',
			title: 'Selbstverwaltung für Mitglieder',
			description:
				'Mitglieder können ihren Plan selbst pausieren, kündigen oder wechseln und ihre Karte im Kundenportal von Stripe aktualisieren. Du musst also keinen Zahlungsdaten hinterherlaufen.'
		}
	],
	benefits: {
		title: 'Warum Vereine und Studios Revel wählen',
		items: [
			'Mitgliedsbeiträge, Kursanmeldungen und Check-in am Einlass an einem Ort',
			'Wiederkehrende Kurse nur für Mitglieder mit einfacher Zusage und fester Obergrenze',
			'Serienpässe funktionieren auch als Kurspakete, Kurse und Saisonkarten',
			'Mitgliedskarten in Apple Wallet und Google Wallet',
			'Kostenlos für kostenlose Events und Offline-Zahlungen, eine kleine Gebühr nur, wenn wir eine Zahlung online abwickeln',
			'Keine Werbung, keine Tracker, und deine Mitgliederliste bleibt deine'
		]
	},
	cta: {
		title: 'Bereit, die Tabelle in Rente zu schicken?',
		description:
			'Richte deinen Verein in wenigen Minuten ein oder probier zuerst die Demo. Keine Kreditkarte nötig.',
		buttons: [
			{ text: 'Live-Demo testen', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Verein erstellen', href: '/register', variant: 'secondary' },
			{ text: 'Kontakt', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Wie funktioniert ein wöchentlicher Kurs nur für Mitglieder?',
			answer:
				'Leg den Kurs als wiederkehrende Serie an, beschränk ihn auf Mitglieder und setz die Kapazität auf zehn. Mitglieder sagen über die Event-Seite zu. Sind die zehn Plätze vergeben, ist der Kurs voll, und wenn du die Warteliste eingeschaltet hast, können sich andere eintragen und bekommen einen Platz angeboten, sobald jemand abspringt. Keine Tickets, keine Zahlungen, nichts abzugleichen.'
		},
		{
			question: 'Kann ich statt einzelner Termine ein Kurspaket oder einen Kurs verkaufen?',
			answer:
				'Ja. Ein Serienpass deckt jedes Event einer Serie ab, egal ob Zehn-Wochen-Kurs, Semester oder Saison. Du legst den Preis fest und entscheidest, ob er nur für Mitglieder gilt, und Revel senkt ihn anteilig für Termine, die schon stattgefunden haben.'
		},
		{
			question: 'Wie bezahlen Mitglieder ihre Mitgliedschaft?',
			answer:
				'Jede Stufe kann Monats-, Jahres- oder lebenslange Pläne haben. Monats- und Jahrespläne können online über Stripe bezahlt werden und verlängern sich automatisch. Für Bargeld, Überweisungen oder eine einmalige Zahlung für eine lebenslange Mitgliedschaft richtest du einen Offline-Plan ein und erfasst die Zahlungen selbst im Dashboard, kostenlos.'
		},
		{
			question: 'Gibt es eine physische Mitgliedskarte?',
			answer:
				'Jedes Mitglied bekommt eine digitale Karte für Apple Wallet und Google Wallet sowie ein PDF zum Herunterladen. Am Einlass scannst du den QR-Code mit dem Check-in-Scanner von Revel und siehst, ob die Mitgliedschaft aktiv ist.'
		},
		{
			question: 'Was kostet das?',
			answer:
				'Nichts für kostenlose Events, Zusagen und offline bezahlte Mitgliedschaften. Wenn Revel eine Online-Zahlung für dich abwickelt, fällt eine kleine Gebühr an (1,5% + 0,25€ pro Transaktion). Selbst hosten ist unter der MIT-Lizenz kostenlos.'
		},
		{
			question: 'Ist Revel nur für Sportvereine?',
			answer:
				'Nein. Mit denselben Tools laufen Yoga- und Pilates-Studios, Tanz- und Musikschulen, Chöre, Kletterhallen, Ruder- und Radsportvereine, Makerspaces und jede Community, die eine Mitgliedschaft mit regelmäßigen Terminen verbindet.'
		}
	],
	relatedPages: ['community-first-event-platform', 'eventbrite-alternative']
};

export const clubMembershipManagementIT: LandingPageContent = {
	slug: 'club-membership-management',
	locale: 'it',
	meta: {
		title: 'Gestione soci per club: abbonamenti, lezioni e pass | Revel',
		description:
			'Software open source per gestire i soci di palestre, studi di yoga, scuole di danza, associazioni sportive e cori. Piani mensili, annuali o a vita, lezioni riservate ai membri, pass per le lezioni e tessere nel wallet.',
		keywords:
			'gestione soci, software gestione soci, gestionale associazione sportiva, software gestione palestra, abbonamenti studio yoga, gestione club sportivo, prenotazione lezioni con abbonamento, eventi riservati ai soci, tessera associativa digitale'
	},
	hero: {
		headline: 'Gestisci un club, non un foglio di calcolo',
		subheadline:
			"Abbonamenti, lezioni riservate ai membri, pass per la serie e tessere nel wallet in un'unica piattaforma open source. Va bene per la palestra con 50 membri come per il coro con 500."
	},
	intro: {
		paragraphs: [
			'Immagina una palestra con cinquanta membri che organizza una lezione settimanale per dieci persone. Oggi significa un foglio di calcolo per gli abbonamenti, un gruppo WhatsApp per le iscrizioni, un promemoria di pagamento ogni mese e una tessera plastificata che nessuno si porta dietro. Revel sostituisce tutto questo.',
			"I membri pagano ogni mese, ogni anno oppure una volta sola per un abbonamento a vita. La lezione settimanale è un evento riservato ai membri: i membri confermano finché i dieci posti non finiscono e, se attivi la lista d'attesa, chi arriva tardi può mettersi in coda in caso di disdetta. Preferisci i pacchetti di lezioni? Vendi un pass per l'intera serie e ogni sessione è coperta. La tessera sta in Apple Wallet o Google Wallet, quindi il check-in è una scansione veloce.",
			'Funziona allo stesso modo per uno studio di yoga, una scuola di danza, un club di arrampicata, una società di canottaggio o un coro. Revel è open source e gratuito per gli eventi gratuiti, quindi non paghi nulla finché non fai pagare davvero qualcosa.'
		]
	},
	features: [
		{
			icon: 'users',
			title: 'Livelli e piani di abbonamento',
			description:
				'Livelli come Socio, Studente o Famiglia, ciascuno con piani mensili, annuali o a vita. Incassa online tramite Stripe, oppure usa piani offline e registra tu contanti e bonifici.'
		},
		{
			icon: 'lock',
			title: 'Lezioni riservate ai membri',
			description:
				'Riserva qualsiasi evento ai membri e dedica fasce di biglietti a livelli di abbonamento specifici. Una lezione settimanale per dieci persone è un evento riservato ai membri, con RSVP e un limite di dieci posti.'
		},
		{
			icon: 'ticket',
			title: 'Pass per la serie',
			description:
				"Vendi un unico pass per un'intera serie di sessioni, un corso o una stagione. Se vuoi, riservalo ai membri. Chi si aggiunge in corsa paga automaticamente un prezzo pro rata."
		},
		{
			icon: 'heart',
			title: 'Tessere nel wallet',
			description:
				"I membri aggiungono la tessera ad Apple Wallet o Google Wallet, oppure scaricano un PDF. All'ingresso la scansioni con lo scanner QR, senza bisogno di tessere stampate."
		},
		{
			icon: 'clipboard',
			title: 'Questionari di ammissione',
			description:
				'Metti un breve questionario prima di un abbonamento: una liberatoria, una verifica del livello, il tuo codice di condotta. Approva a mano, lascia che venga valutato in automatico, o entrambe le cose.'
		},
		{
			icon: 'check',
			title: 'Self-service per i membri',
			description:
				'I membri possono sospendere, disdire o cambiare piano da soli e aggiornare la carta dal portale di pagamento di Stripe, così non devi rincorrere nessuno per i dati di pagamento.'
		}
	],
	benefits: {
		title: 'Perché club e studi scelgono Revel',
		items: [
			"Pagamenti degli abbonamenti, iscrizioni alle lezioni e check-in all'ingresso in un unico posto",
			'Lezioni ricorrenti riservate ai membri con un semplice RSVP e un limite rigido di posti',
			'I pass per la serie valgono anche come pacchetti di lezioni, corsi e abbonamenti stagionali',
			'Tessere in Apple Wallet e Google Wallet',
			'Gratuito per eventi gratuiti e pagamenti offline, con una piccola commissione solo quando elaboriamo noi un pagamento online',
			'Niente pubblicità, niente tracker, e la lista dei membri resta tua'
		]
	},
	cta: {
		title: 'Pronto a mandare in pensione il foglio di calcolo?',
		description:
			'Configura il tuo club in pochi minuti, oppure prova prima la demo. Nessuna carta di credito richiesta.',
		buttons: [
			{ text: 'Prova la demo live', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Crea il tuo club', href: '/register', variant: 'secondary' },
			{ text: 'Contattaci', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Come funziona una lezione settimanale riservata ai membri?',
			answer:
				"Crea la lezione come serie ricorrente, riservala ai membri e imposta la capienza a dieci. I membri confermano dalla pagina dell'evento. Quando i dieci posti sono occupati la lezione è al completo e, se hai attivato la lista d'attesa, le altre persone possono iscriversi e ricevono l'offerta di un posto appena qualcuno si ritira. Niente biglietti, niente pagamenti, niente da riconciliare."
		},
		{
			question: 'Posso vendere un pacchetto di lezioni o un corso invece delle singole sessioni?',
			answer:
				'Sì. Un pass per la serie copre ogni evento di una serie, che sia un corso di dieci settimane, un trimestre o una stagione. Scegli tu il prezzo e se riservarlo ai membri, e Revel lo abbassa pro rata per le sessioni già svolte.'
		},
		{
			question: "Come pagano l'abbonamento i membri?",
			answer:
				'Ogni livello può avere piani mensili, annuali o a vita. I piani mensili e annuali si possono pagare online tramite Stripe e si rinnovano in automatico. Per contanti, bonifici o un pagamento unico per un piano a vita, crea un piano offline e registra tu i pagamenti dalla dashboard, senza costi.'
		},
		{
			question: 'Esiste una tessera fisica?',
			answer:
				"Ogni membro riceve una tessera digitale per Apple Wallet e Google Wallet, più un PDF da scaricare. All'ingresso scansiona il codice QR con lo scanner di check-in di Revel per verificare che l'abbonamento sia attivo."
		},
		{
			question: 'Quanto costa?',
			answer:
				'Nulla per eventi gratuiti, RSVP e abbonamenti pagati offline. Quando Revel elabora un pagamento online per te, si applica una piccola commissione (1,5% + €0,25 per transazione). Il self-hosting è gratuito con licenza MIT.'
		},
		{
			question: 'Revel è solo per i club sportivi?',
			answer:
				'No. Gli stessi strumenti fanno girare studi di yoga e pilates, scuole di danza e di musica, cori, palestre di arrampicata, società di canottaggio e ciclismo, makerspace e qualsiasi community che unisce un abbonamento a sessioni ricorrenti.'
		}
	],
	relatedPages: ['community-first-event-platform', 'eventbrite-alternative']
};

export const clubMembershipManagementFR: LandingPageContent = {
	slug: 'club-membership-management',
	locale: 'fr',
	meta: {
		title: 'Gestion des adhésions de club : adhésions, cours et pass | Revel',
		description:
			'Logiciel open source de gestion des adhésions pour salles de sport, studios de yoga, écoles de danse, clubs sportifs et chorales. Formules mensuelles, annuelles ou à vie, cours réservés aux membres, carnets de cours et cartes de membre dans le wallet.',
		keywords:
			'gestion des adhérents, logiciel de gestion des adhésions, logiciel gestion association, logiciel salle de sport, gestion studio de yoga, gestion club sportif, réservation de cours avec adhésion, événements réservés aux membres, carte de membre numérique'
	},
	hero: {
		headline: 'Gère un club, pas un tableur',
		subheadline:
			'Adhésions, cours réservés aux membres, pass de série et cartes dans le wallet, sur une seule plateforme open source. Ça marche pour une salle de sport de 50 membres comme pour une chorale de 500.'
	},
	intro: {
		paragraphs: [
			"Imagine une salle de sport de cinquante membres qui propose un cours hebdomadaire pour dix personnes. Aujourd'hui, ça veut dire un tableur pour les adhésions, un groupe WhatsApp pour les inscriptions, un rappel de paiement chaque mois et une carte plastifiée que personne n'a sur soi. Revel remplace tout ça.",
			"Les membres paient au mois, à l'année ou une seule fois pour une adhésion à vie. Le cours hebdomadaire est un événement réservé aux membres : les membres s'inscrivent jusqu'à ce que les dix places soient prises et, si tu actives la liste d'attente, les retardataires peuvent se mettre en file pour profiter d'un désistement. Tu préfères les carnets de cours ? Vends un pass pour toute la série et chaque séance est couverte. La carte de membre est dans Apple Wallet ou Google Wallet, donc le check-in se fait en un scan.",
			"Ça marche exactement pareil pour un studio de yoga, une école de danse, un club d'escalade, un club d'aviron ou une chorale. Revel est open source et gratuit pour les événements gratuits, donc tu ne paies rien tant que tu ne fais rien payer."
		]
	},
	features: [
		{
			icon: 'users',
			title: "Niveaux d'adhésion et formules",
			description:
				'Des niveaux comme Membre, Étudiant·e ou Famille, chacun avec des formules mensuelles, annuelles ou à vie. Encaisse en ligne via Stripe, ou utilise des formules hors ligne et enregistre toi-même les espèces et les virements.'
		},
		{
			icon: 'lock',
			title: 'Cours réservés aux membres',
			description:
				"Réserve n'importe quel événement aux membres et dédie des catégories de billets à certains niveaux d'adhésion. Un cours hebdomadaire pour dix, c'est un événement réservé aux membres avec un RSVP et une limite de dix places."
		},
		{
			icon: 'ticket',
			title: 'Pass de série',
			description:
				'Vends un seul pass pour toute une série de séances, un cycle de cours ou une saison. Réserve-le aux membres si tu veux. Les personnes qui arrivent en cours de route paient automatiquement un prix au prorata.'
		},
		{
			icon: 'heart',
			title: 'Cartes de membre dans le wallet',
			description:
				"Les membres ajoutent leur carte à Apple Wallet ou Google Wallet, ou téléchargent un PDF. Scanne-la à l'entrée avec le scanner QR, pas besoin de carte imprimée."
		},
		{
			icon: 'clipboard',
			title: "Questionnaires d'admission",
			description:
				'Place un court questionnaire avant une adhésion : une décharge, un test de niveau, ton code de conduite. Valide à la main, laisse la notation automatique faire le travail, ou combine les deux.'
		},
		{
			icon: 'check',
			title: 'Autonomie pour les membres',
			description:
				"Les membres peuvent suspendre, résilier ou changer de formule eux-mêmes et mettre à jour leur carte via le portail de facturation de Stripe. Tu n'as plus à courir après les coordonnées bancaires."
		}
	],
	benefits: {
		title: 'Pourquoi les clubs et les studios choisissent Revel',
		items: [
			"Paiements des adhésions, inscriptions aux cours et check-in à l'entrée au même endroit",
			'Cours récurrents réservés aux membres, avec un simple RSVP et une limite stricte de places',
			"Des pass de série qui servent aussi de carnets de cours, de cycles et d'abonnements de saison",
			'Cartes de membre dans Apple Wallet et Google Wallet',
			'Gratuit pour les événements gratuits et les paiements hors ligne, avec une petite commission seulement quand nous traitons un paiement en ligne',
			'Pas de pub, pas de traceurs, et ta liste de membres reste à toi'
		]
	},
	cta: {
		title: 'Prêt à mettre le tableur à la retraite ?',
		description:
			"Configure ton club en quelques minutes, ou teste d'abord la démo. Aucune carte bancaire requise.",
		buttons: [
			{ text: 'Tester la démo live', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Créer ton club', href: '/register', variant: 'secondary' },
			{ text: 'Nous contacter', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Comment fonctionne un cours hebdomadaire réservé aux membres ?',
			answer:
				"Crée le cours sous forme de série récurrente, réserve-le aux membres et règle la capacité sur dix. Les membres s'inscrivent depuis la page de l'événement. Une fois les dix places prises, le cours est complet et, si tu as activé la liste d'attente, d'autres personnes peuvent s'y inscrire et se voient proposer une place dès que quelqu'un se désiste. Pas de billets, pas de paiements, rien à rapprocher."
		},
		{
			question: "Puis-je vendre un carnet de cours ou un cycle plutôt que des séances à l'unité ?",
			answer:
				"Oui. Un pass de série couvre tous les événements d'une série, que ce soit un cycle de dix semaines, un trimestre ou une saison. Tu fixes le prix et décides s'il est réservé aux membres, et Revel le baisse au prorata pour les séances déjà passées."
		},
		{
			question: 'Comment les membres paient-ils leur adhésion ?',
			answer:
				'Chaque niveau peut proposer des formules mensuelles, annuelles ou à vie. Les formules mensuelles et annuelles peuvent se payer en ligne via Stripe et se renouvellent automatiquement. Pour les espèces, les virements ou un paiement unique pour une adhésion à vie, crée une formule hors ligne et enregistre toi-même les paiements dans le tableau de bord, sans frais.'
		},
		{
			question: 'Y a-t-il une carte de membre physique ?',
			answer:
				"Chaque membre reçoit une carte numérique pour Apple Wallet et Google Wallet, plus un PDF à télécharger. À l'entrée, scanne le QR code avec le scanner de check-in de Revel pour vérifier que l'adhésion est active."
		},
		{
			question: 'Combien ça coûte ?',
			answer:
				"Rien pour les événements gratuits, les RSVP et les adhésions payées hors ligne. Quand Revel traite un paiement en ligne pour toi, une petite commission s'applique (1,5 % + 0,25 € par transaction). L'auto-hébergement est gratuit sous licence MIT."
		},
		{
			question: 'Revel est-il réservé aux clubs sportifs ?',
			answer:
				"Non. Les mêmes outils font tourner des studios de yoga et de pilates, des écoles de danse et de musique, des chorales, des salles d'escalade, des clubs d'aviron et de vélo, des makerspaces et toute communauté qui combine une adhésion avec des séances récurrentes."
		}
	],
	relatedPages: ['community-first-event-platform', 'eventbrite-alternative']
};

export const clubMembershipManagementES: LandingPageContent = {
	slug: 'club-membership-management',
	locale: 'es',
	meta: {
		title: 'Gestión de membresías para clubes: cuotas, clases y pases | Revel',
		description:
			'Software open source de gestión de membresías para gimnasios, estudios de yoga, escuelas de baile, clubes deportivos y coros. Planes mensuales, anuales o vitalicios, clases solo para miembros, bonos de clases y carnets de miembro en el wallet.',
		keywords:
			'gestión de socios, software de gestión de membresías, software para gimnasios, programa de gestión de club deportivo, membresías estudio de yoga, reserva de clases con membresía, eventos solo para socios, carnet de socio digital'
	},
	hero: {
		headline: 'Gestiona un club, no una hoja de cálculo',
		subheadline:
			'Membresías, clases solo para miembros, pases de serie y carnets en el wallet en una sola plataforma open source. Sirve igual para un gimnasio con 50 miembros que para un coro con 500.'
	},
	intro: {
		paragraphs: [
			'Imagina un gimnasio con cincuenta miembros que organiza una clase semanal para diez personas. Hoy eso significa una hoja de cálculo de membresías, un grupo de WhatsApp para apuntarse, un recordatorio de pago cada mes y un carnet plastificado que nadie lleva encima. Revel lo sustituye todo.',
			'Los miembros pagan cada mes, cada año o una sola vez por una membresía vitalicia. La clase semanal es un evento solo para miembros: los miembros confirman asistencia hasta que se acaban las diez plazas y, si activas la lista de espera, quien llegue tarde puede apuntarse por si alguien cancela. ¿Prefieres bonos de clases? Vende un pase para toda la serie y todas las sesiones quedan cubiertas. El carnet de miembro está en Apple Wallet o Google Wallet, así que el check-in es un escaneo rápido.',
			'Funciona igual para un estudio de yoga, una escuela de baile, un club de escalada, un club de remo o un coro. Revel es open source y gratuito para eventos gratuitos, así que no pagas nada hasta que realmente cobras por algo.'
		]
	},
	features: [
		{
			icon: 'users',
			title: 'Niveles y planes de membresía',
			description:
				'Niveles como Miembro, Estudiante o Familia, cada uno con planes mensuales, anuales o vitalicios. Cobra en línea con Stripe, o usa planes offline y registra tú los pagos en efectivo y las transferencias.'
		},
		{
			icon: 'lock',
			title: 'Clases solo para miembros',
			description:
				'Haz que cualquier evento sea solo para miembros y reserva tipos de entrada para niveles de membresía concretos. Una clase semanal para diez es un evento solo para miembros con RSVP y un límite de diez plazas.'
		},
		{
			icon: 'ticket',
			title: 'Pases de serie',
			description:
				'Vende un único pase para toda una serie de sesiones, un curso o una temporada. Si quieres, déjalo solo para miembros. Quien se incorpora tarde paga automáticamente un precio prorrateado.'
		},
		{
			icon: 'heart',
			title: 'Carnets de miembro en el wallet',
			description:
				'Los miembros añaden su carnet a Apple Wallet o Google Wallet, o descargan un PDF. Escanéalo en la puerta con el escáner QR, sin necesidad de carnet impreso.'
		},
		{
			icon: 'clipboard',
			title: 'Cuestionarios de admisión',
			description:
				'Pon un cuestionario breve antes de una membresía: una exención de responsabilidad, una prueba de nivel, tu código de conducta. Aprueba a mano, deja que se puntúe de forma automática, o las dos cosas.'
		},
		{
			icon: 'check',
			title: 'Autogestión para los miembros',
			description:
				'Los miembros pueden pausar, cancelar o cambiar de plan por su cuenta y actualizar su tarjeta en el portal de facturación de Stripe, así no tienes que ir detrás de nadie para pedir datos de pago.'
		}
	],
	benefits: {
		title: 'Por qué los clubes y estudios eligen Revel',
		items: [
			'Pagos de membresías, inscripciones a clases y check-in en la puerta en un solo lugar',
			'Clases recurrentes solo para miembros con un RSVP sencillo y un límite estricto de plazas',
			'Los pases de serie sirven también como bonos de clases, cursos y abonos de temporada',
			'Carnets de miembro en Apple Wallet y Google Wallet',
			'Gratis para eventos gratuitos y pagos offline, con una pequeña comisión solo cuando procesamos un pago en línea',
			'Sin anuncios, sin rastreadores, y tu lista de miembros sigue siendo tuya'
		]
	},
	cta: {
		title: '¿Listo para jubilar la hoja de cálculo?',
		description:
			'Configura tu club en minutos o prueba primero la demo. No hace falta tarjeta de crédito.',
		buttons: [
			{ text: 'Probar la demo en vivo', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Crear tu club', href: '/register', variant: 'secondary' },
			{ text: 'Contáctanos', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: '¿Cómo funciona una clase semanal solo para miembros?',
			answer:
				'Crea la clase como una serie recurrente, déjala solo para miembros y pon el aforo en diez. Los miembros confirman asistencia desde la página del evento. Cuando se ocupan las diez plazas, la clase está completa y, si has activado la lista de espera, otras personas pueden apuntarse y reciben la oferta de una plaza en cuanto alguien se da de baja. Sin entradas, sin pagos, nada que cuadrar.'
		},
		{
			question: '¿Puedo vender un bono de clases o un curso en vez de sesiones sueltas?',
			answer:
				'Sí. Un pase de serie cubre todos los eventos de una serie, ya sea un curso de diez semanas, un trimestre o una temporada. Tú fijas el precio y decides si es solo para miembros, y Revel lo rebaja de forma prorrateada por las sesiones que ya se han celebrado.'
		},
		{
			question: '¿Cómo pagan los miembros su membresía?',
			answer:
				'Cada nivel puede tener planes mensuales, anuales o vitalicios. Los planes mensuales y anuales pueden pagarse en línea a través de Stripe y se renuevan automáticamente. Para efectivo, transferencias o un pago único por una membresía vitalicia, crea un plan offline y registra tú los pagos en el panel, sin coste.'
		},
		{
			question: '¿Hay un carnet de miembro físico?',
			answer:
				'Cada miembro recibe un carnet digital para Apple Wallet y Google Wallet, además de un PDF descargable. En la puerta, escanea el código QR con el escáner de check-in de Revel para confirmar que la membresía está activa.'
		},
		{
			question: '¿Cuánto cuesta?',
			answer:
				'Nada para eventos gratuitos, RSVP y membresías pagadas offline. Cuando Revel procesa un pago en línea por ti, se aplica una pequeña comisión (1,5 % + 0,25 € por transacción). Autoalojarlo es gratis bajo la licencia MIT.'
		},
		{
			question: '¿Revel es solo para clubes deportivos?',
			answer:
				'No. Las mismas herramientas sirven para estudios de yoga y pilates, escuelas de baile y de música, coros, rocódromos, clubes de remo y de ciclismo, espacios maker y cualquier comunidad que combine una membresía con sesiones recurrentes.'
		}
	],
	relatedPages: ['community-first-event-platform', 'eventbrite-alternative']
};

export const clubMembershipManagementPT: LandingPageContent = {
	slug: 'club-membership-management',
	locale: 'pt',
	meta: {
		title: 'Gestão de membros para clubes: quotas, aulas e passes | Revel',
		description:
			'Software open source de gestão de membros para ginásios, estúdios de yoga, escolas de dança, clubes desportivos e coros. Planos mensais, anuais ou vitalícios, aulas só para membros, pacotes de aulas e cartões de membro na wallet.',
		keywords:
			'gestão de sócios, gestão de membros, software de gestão de membros, software para ginásios, gestão de clube desportivo, gestão de associações, marcação de aulas com quotas, eventos só para sócios, cartão de sócio digital'
	},
	hero: {
		headline: 'Gere um clube, não uma folha de cálculo',
		subheadline:
			'Quotas, aulas só para membros, passes de série e cartões na wallet numa única plataforma open source. Funciona para um ginásio com 50 membros e para um coro com 500.'
	},
	intro: {
		paragraphs: [
			'Imagina um ginásio com cinquenta membros que dá uma aula semanal para dez pessoas. Hoje isso significa uma folha de cálculo com as quotas, um grupo de WhatsApp para as inscrições, um lembrete de pagamento todos os meses e um cartão plastificado que ninguém traz consigo. O Revel substitui tudo isto.',
			'Os membros pagam ao mês, ao ano ou uma única vez por uma adesão vitalícia. A aula semanal é um evento só para membros: os membros confirmam até os dez lugares esgotarem e, se ativares a lista de espera, quem chega tarde pode ficar na fila para o caso de alguém desistir. Preferes pacotes de aulas? Vende um passe para toda a série e todas as sessões ficam cobertas. O cartão de membro está na Apple Wallet ou na Google Wallet, por isso o check-in é uma leitura rápida.',
			'Funciona da mesma forma para um estúdio de yoga, uma escola de dança, um clube de escalada, um clube de remo ou um coro. O Revel é open source e gratuito para eventos gratuitos, por isso não pagas nada até cobrares realmente por alguma coisa.'
		]
	},
	features: [
		{
			icon: 'users',
			title: 'Escalões e planos de adesão',
			description:
				'Escalões como Membro, Estudante ou Família, cada um com planos mensais, anuais ou vitalícios. Recebe pagamentos online através da Stripe, ou usa planos offline e regista tu os pagamentos em dinheiro e por transferência.'
		},
		{
			icon: 'lock',
			title: 'Aulas só para membros',
			description:
				'Torna qualquer evento exclusivo para membros e reserva tipos de bilhete para escalões de adesão específicos. Uma aula semanal para dez é um evento só para membros com RSVP e um limite de dez lugares.'
		},
		{
			icon: 'ticket',
			title: 'Passes de série',
			description:
				'Vende um único passe para toda uma série de sessões, um curso ou uma temporada. Se quiseres, deixa-o só para membros. Quem entra mais tarde paga automaticamente um preço proporcional.'
		},
		{
			icon: 'heart',
			title: 'Cartões de membro na wallet',
			description:
				'Os membros adicionam o cartão à Apple Wallet ou à Google Wallet, ou descarregam um PDF. Lê-o à porta com o leitor de QR, sem precisar de cartão impresso.'
		},
		{
			icon: 'clipboard',
			title: 'Questionários de admissão',
			description:
				'Coloca um questionário curto antes de uma adesão: um termo de responsabilidade, uma verificação de nível, o teu código de conduta. Aprova à mão, deixa a pontuação automática tratar disso, ou as duas coisas.'
		},
		{
			icon: 'check',
			title: 'Autonomia para os membros',
			description:
				'Os membros podem pausar, cancelar ou mudar de plano sozinhos e atualizar o cartão no portal de faturação da Stripe, por isso não tens de andar atrás de ninguém por causa dos dados de pagamento.'
		}
	],
	benefits: {
		title: 'Porque é que clubes e estúdios escolhem o Revel',
		items: [
			'Pagamento de quotas, inscrições nas aulas e check-in à porta num só lugar',
			'Aulas recorrentes só para membros com um RSVP simples e um limite fixo de lugares',
			'Passes de série que servem de pacotes de aulas, cursos e bilhetes de temporada',
			'Cartões de membro na Apple Wallet e na Google Wallet',
			'Gratuito para eventos gratuitos e pagamentos offline, com uma pequena comissão só quando processamos um pagamento online',
			'Sem anúncios, sem rastreadores, e a tua lista de membros continua a ser tua'
		]
	},
	cta: {
		title: 'Pronto para reformar a folha de cálculo?',
		description:
			'Configura o teu clube em minutos ou experimenta primeiro a demo. Não precisas de cartão de crédito.',
		buttons: [
			{
				text: 'Experimentar a demo em direto',
				href: 'https://demo.letsrevel.io',
				variant: 'primary'
			},
			{ text: 'Criar o teu clube', href: '/register', variant: 'secondary' },
			{ text: 'Contacta-nos', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Como funciona uma aula semanal só para membros?',
			answer:
				'Cria a aula como uma série recorrente, deixa-a só para membros e define a capacidade como dez. Os membros confirmam a partir da página do evento. Quando os dez lugares estiverem ocupados, a aula fica cheia e, se ativaste a lista de espera, outras pessoas podem inscrever-se nela e recebem a oferta de um lugar assim que alguém desiste. Sem bilhetes, sem pagamentos, nada para conciliar.'
		},
		{
			question: 'Posso vender um pacote de aulas ou um curso em vez de sessões avulsas?',
			answer:
				'Sim. Um passe de série cobre todos os eventos de uma série, seja um curso de dez semanas, um período letivo ou uma temporada. Tu defines o preço e decides se é só para membros, e o Revel baixa-o proporcionalmente pelas sessões que já aconteceram.'
		},
		{
			question: 'Como é que os membros pagam a adesão?',
			answer:
				'Cada escalão pode ter planos mensais, anuais ou vitalícios. Os planos mensais e anuais podem ser pagos online através da Stripe e renovam-se automaticamente. Para dinheiro, transferências ou um pagamento único por uma adesão vitalícia, cria um plano offline e regista tu os pagamentos no painel, sem custos.'
		},
		{
			question: 'Existe um cartão de membro físico?',
			answer:
				'Cada membro recebe um cartão digital para a Apple Wallet e a Google Wallet, além de um PDF para descarregar. À porta, lê o código QR com o leitor de check-in do Revel para confirmar que a adesão está ativa.'
		},
		{
			question: 'Quanto custa?',
			answer:
				'Nada para eventos gratuitos, RSVP e adesões pagas offline. Quando o Revel processa um pagamento online por ti, aplica-se uma pequena comissão (1,5 % + 0,25 € por transação). O alojamento próprio é gratuito ao abrigo da licença MIT.'
		},
		{
			question: 'O Revel é só para clubes desportivos?',
			answer:
				'Não. As mesmas ferramentas servem estúdios de yoga e pilates, escolas de dança e de música, coros, ginásios de escalada, clubes de remo e de ciclismo, makerspaces e qualquer comunidade que combine uma adesão com sessões recorrentes.'
		}
	],
	relatedPages: ['community-first-event-platform', 'eventbrite-alternative']
};
