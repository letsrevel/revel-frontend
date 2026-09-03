import type { LandingPageContent } from './types';

export const clubMembershipManagementEN: LandingPageContent = {
	slug: 'club-membership-management',
	locale: 'en',
	meta: {
		title: 'Club Membership Management – Memberships, Classes & Passes | Revel',
		description:
			'Free, open-source membership management for gyms, yoga studios, dance schools, sports clubs and choirs. Monthly or annual memberships, members-only classes with a plain RSVP, class passes, and membership cards in Apple and Google Wallet.',
		keywords:
			'club membership management, membership management software, gym membership software, yoga studio membership, sports club management, class booking with memberships, members-only events, digital membership card'
	},
	hero: {
		headline: 'Run a Club, Not a Spreadsheet',
		subheadline:
			'Memberships, members-only classes, series passes and wallet cards in one free, open-source platform. Built for the gym with 50 members and the choir with 500.'
	},
	intro: {
		paragraphs: [
			'Picture a gym with fifty members that runs a weekly class for ten people. Today that means a membership spreadsheet, a WhatsApp group for sign-ups, a payment reminder every month, and a laminated card nobody carries. Revel replaces all of it.',
			'Members pay a monthly or annual membership. The weekly class is a members-only event: members RSVP, the ten spots fill, the rest go on the waitlist, done. Prefer a class pack? Sell a pass for the whole series, members only, and every session is covered. The membership card lives in Apple Wallet or Google Wallet, so the door check is a scan.',
			'It works the same way for a yoga studio, a dance school, a climbing club, a rowing club or a choir. And because Revel is open source and free for free events, you pay nothing until you actually charge for something.'
		]
	},
	features: [
		{
			icon: 'users',
			title: 'Membership Tiers & Plans',
			description:
				'Create tiers like Member, Student or Family, each with monthly or annual plans. Payments run through Stripe, or record cash and wire transfers yourself in the dashboard.'
		},
		{
			icon: 'lock',
			title: 'Members-Only Classes',
			description:
				'Any event can be restricted to members or to specific tiers. A weekly class for ten people is a members-only event with a plain RSVP and a capacity of ten.'
		},
		{
			icon: 'ticket',
			title: 'Series Passes',
			description:
				'Sell one pass for a whole series of sessions, a course or a season. Restrict it to members if you like. Late joiners pay a pro-rata price automatically.'
		},
		{
			icon: 'heart',
			title: 'Wallet Membership Cards',
			description:
				'Members add their card to Apple Wallet or Google Wallet, or download a PDF. Check it at the door with the QR scanner, no printed card required.'
		},
		{
			icon: 'clipboard',
			title: 'Approval Questionnaires',
			description:
				'Gate a tier behind a short questionnaire — a waiver, a level check, a code of conduct — and approve automatically, manually or both.'
		},
		{
			icon: 'shield',
			title: 'Private by Default',
			description:
				"Members' data stays yours. No ads, no trackers, no selling your member list. GDPR-native, and self-hostable if you want full control."
		}
	],
	benefits: {
		title: 'Why Clubs and Studios Choose Revel',
		items: [
			'Membership payments, class sign-ups and the door check in one place',
			'Members-only recurring classes with a plain RSVP and a hard capacity',
			'Series passes double as class packs, courses and season tickets',
			'Membership cards in Apple Wallet and Google Wallet',
			'Free for free events and RSVPs; a small fee only when we process a payment',
			'Open source and self-hostable, so your club is never locked in'
		]
	},
	cta: {
		title: 'Ready to Retire the Spreadsheet?',
		description: 'Create your club in minutes, or try the demo first. No credit card required.',
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
				'Create the class as a recurring event, set its visibility to members only and its capacity to ten. Members RSVP from the event page or the app; once the ten spots are taken, further RSVPs join the waitlist. No tickets, no payments, nothing to reconcile.'
		},
		{
			question: 'Can I sell a class pack or a course instead of single sessions?',
			answer:
				'Yes. A series pass covers every event in a series — a ten-week course, a term, a season. You choose the price, whether it is members only, and Revel discounts it pro rata for sessions that have already happened.'
		},
		{
			question: 'How do members pay their membership?',
			answer:
				'Each tier can have monthly or annual plans paid online through Stripe. If your club collects cash or bank transfers, mark the membership as paid yourself in the dashboard — that works on any plan and costs nothing.'
		},
		{
			question: 'Is there a physical membership card?',
			answer:
				'Every member gets a digital card for Apple Wallet and Google Wallet, plus a downloadable PDF. At the door, scan the QR code with the Revel check-in scanner to confirm the membership is active.'
		},
		{
			question: 'What does it cost?',
			answer:
				'Nothing for free events, RSVPs and memberships you manage manually. When Revel processes a payment for you, a small fee applies (1.5% + €0.25 per transaction). Self-hosting is free under the MIT license.'
		},
		{
			question: 'Is Revel only for sports clubs?',
			answer:
				'No. The same tools run yoga and pilates studios, dance and music schools, choirs, climbing gyms, rowing and cycling clubs, makerspaces and any community that combines a membership with recurring sessions.'
		}
	],
	relatedPages: ['community-first-event-platform', 'eventbrite-alternative']
};

export const clubMembershipManagementDE: LandingPageContent = {
	slug: 'club-membership-management',
	locale: 'de',
	meta: {
		title: 'Mitgliederverwaltung für Vereine & Studios – Kurse & Pässe | Revel',
		description:
			'Kostenlose Open-Source-Mitgliederverwaltung für Studios, Vereine und Chöre: Monats- oder Jahresmitgliedschaften, Kurse nur für Mitglieder, Serienpässe, Wallet-Karten.',
		keywords:
			'mitgliederverwaltung verein, mitgliederverwaltung software, fitnessstudio mitgliedschaft software, yogastudio mitgliedschaft, sportverein verwaltung, kursbuchung mit mitgliedschaft, events nur für mitglieder, digitale mitgliedskarte'
	},
	hero: {
		headline: 'Führ einen Verein, keine Tabelle',
		subheadline:
			'Mitgliedschaften, Kurse nur für Mitglieder, Serienpässe und Wallet-Karten in einer kostenlosen Open-Source-Plattform. Gebaut für das Fitnessstudio mit 50 Mitgliedern und den Chor mit 500.'
	},
	intro: {
		paragraphs: [
			'Stell dir ein Fitnessstudio mit fünfzig Mitgliedern vor, das jede Woche einen Kurs für zehn Personen anbietet. Heute heißt das: eine Mitgliedertabelle, eine WhatsApp-Gruppe für die Anmeldungen, jeden Monat eine Zahlungserinnerung und eine laminierte Karte, die niemand dabeihat. Revel ersetzt das alles.',
			'Mitglieder zahlen eine Monats- oder Jahresmitgliedschaft. Der wöchentliche Kurs ist ein Event nur für Mitglieder: Mitglieder sagen zu, die zehn Plätze füllen sich, der Rest landet auf der Warteliste, fertig. Lieber ein Kurspaket? Verkaufe einen Pass für die ganze Serie, nur für Mitglieder, und jeder Termin ist abgedeckt. Die Mitgliedskarte liegt in Apple Wallet oder Google Wallet, der Check am Einlass ist ein Scan.',
			'Genauso funktioniert es für ein Yogastudio, eine Tanzschule, einen Kletterclub, einen Ruderverein oder einen Chor. Und weil Revel Open Source und für kostenlose Events gratis ist, zahlst du nichts, bis du tatsächlich Geld für etwas verlangst.'
		]
	},
	features: [
		{
			icon: 'users',
			title: 'Mitgliedschaftsstufen & Pläne',
			description:
				'Lege Stufen wie Mitglied, Student*in oder Familie an, jede mit Monats- oder Jahresplänen. Zahlungen laufen über Stripe, oder du erfasst Bar- und Überweisungszahlungen selbst im Dashboard.'
		},
		{
			icon: 'lock',
			title: 'Kurse nur für Mitglieder',
			description:
				'Jedes Event lässt sich auf Mitglieder oder bestimmte Stufen beschränken. Ein wöchentlicher Kurs für zehn Personen ist ein Event nur für Mitglieder mit einfacher Zusage und einer Kapazität von zehn.'
		},
		{
			icon: 'ticket',
			title: 'Serienpässe',
			description:
				'Verkaufe einen Pass für eine ganze Serie von Terminen, einen Kurs oder eine Saison. Beschränke ihn auf Mitglieder, wenn du willst. Wer später einsteigt, zahlt automatisch einen anteiligen Preis.'
		},
		{
			icon: 'heart',
			title: 'Mitgliedskarten im Wallet',
			description:
				'Mitglieder legen ihre Karte in Apple Wallet oder Google Wallet ab oder laden ein PDF herunter. Am Einlass prüfst du sie mit dem QR-Scanner, ganz ohne gedruckte Karte.'
		},
		{
			icon: 'clipboard',
			title: 'Fragebögen zur Freigabe',
			description:
				'Sichere eine Stufe mit einem kurzen Fragebogen ab — Haftungsausschluss, Levelcheck, Verhaltenskodex — und gib automatisch, manuell oder in Kombination frei.'
		},
		{
			icon: 'shield',
			title: 'Standardmäßig privat',
			description:
				'Die Daten deiner Mitglieder bleiben deine. Keine Werbung, keine Tracker, kein Verkauf deiner Mitgliederliste. DSGVO-nativ und selbst hostbar, wenn du volle Kontrolle willst.'
		}
	],
	benefits: {
		title: 'Warum Vereine und Studios Revel wählen',
		items: [
			'Mitgliedsbeiträge, Kursanmeldungen und Check-in am Einlass an einem Ort',
			'Wiederkehrende Kurse nur für Mitglieder mit einfacher Zusage und fester Kapazität',
			'Serienpässe funktionieren als Kurspakete, Kurse und Saisonkarten',
			'Mitgliedskarten in Apple Wallet und Google Wallet',
			'Kostenlos für kostenlose Events und Zusagen; eine kleine Gebühr nur, wenn wir eine Zahlung abwickeln',
			'Open Source und selbst hostbar, damit dein Verein nie im Lock-in steckt'
		]
	},
	cta: {
		title: 'Bereit, die Tabelle in Rente zu schicken?',
		description:
			'Erstelle deinen Verein in wenigen Minuten oder probier zuerst die Demo. Keine Kreditkarte erforderlich.',
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
				'Erstelle den Kurs als wiederkehrendes Event, stelle die Sichtbarkeit auf „nur Mitglieder“ und die Kapazität auf zehn. Mitglieder sagen über die Event-Seite oder die App zu; sind die zehn Plätze vergeben, landen weitere Zusagen auf der Warteliste. Keine Tickets, keine Zahlungen, nichts abzugleichen.'
		},
		{
			question: 'Kann ich ein Kurspaket oder einen Kurs statt einzelner Termine verkaufen?',
			answer:
				'Ja. Ein Serienpass deckt jedes Event einer Serie ab — einen Zehn-Wochen-Kurs, ein Trimester, eine Saison. Du legst den Preis fest und ob er nur für Mitglieder gilt, und Revel rechnet bereits vergangene Termine automatisch anteilig heraus.'
		},
		{
			question: 'Wie bezahlen Mitglieder ihre Mitgliedschaft?',
			answer:
				'Jede Stufe kann Monats- oder Jahrespläne haben, die online über Stripe bezahlt werden. Wenn dein Verein bar oder per Überweisung kassiert, markierst du die Mitgliedschaft selbst im Dashboard als bezahlt — das geht bei jedem Plan und kostet nichts.'
		},
		{
			question: 'Gibt es eine physische Mitgliedskarte?',
			answer:
				'Jedes Mitglied bekommt eine digitale Karte für Apple Wallet und Google Wallet sowie ein PDF zum Herunterladen. Am Einlass scannst du den QR-Code mit dem Revel Check-in-Scanner und siehst sofort, ob die Mitgliedschaft aktiv ist.'
		},
		{
			question: 'Was kostet das?',
			answer:
				'Nichts für kostenlose Events, Zusagen und Mitgliedschaften, die du manuell verwaltest. Wenn Revel eine Zahlung für dich abwickelt, fällt eine kleine Gebühr an (1,5 % + 0,25 € pro Transaktion). Selbst hosten ist unter der MIT-Lizenz kostenlos.'
		},
		{
			question: 'Ist Revel nur für Sportvereine?',
			answer:
				'Nein. Dieselben Tools laufen in Yoga- und Pilates-Studios, Tanz- und Musikschulen, Chören, Kletterhallen, Ruder- und Radsportvereinen, Makerspaces und jeder Community, die eine Mitgliedschaft mit wiederkehrenden Terminen verbindet.'
		}
	],
	relatedPages: ['community-first-event-platform', 'eventbrite-alternative']
};

export const clubMembershipManagementIT: LandingPageContent = {
	slug: 'club-membership-management',
	locale: 'it',
	meta: {
		title: 'Gestione Membri per Club – Abbonamenti, Lezioni e Pass | Revel',
		description:
			'Gestione abbonamenti gratuita e open source per palestre, studi di yoga, scuole di danza, club e cori. Lezioni riservate ai membri, pass per la serie, tessere nel wallet.',
		keywords:
			'gestione soci, software gestione soci, gestione membri club, software gestione palestra, abbonamenti studio yoga, gestionale associazione sportiva, prenotazione lezioni con abbonamento, eventi riservati ai membri, tessera associativa digitale'
	},
	hero: {
		headline: 'Gestisci un club, non un foglio di calcolo',
		subheadline:
			"Abbonamenti, lezioni riservate ai membri, pass per la serie e tessere nel wallet in un'unica piattaforma gratuita e open source. Pensata per la palestra con 50 membri e per il coro con 500."
	},
	intro: {
		paragraphs: [
			'Immagina una palestra con cinquanta membri che organizza una lezione settimanale per dieci persone. Oggi significa un foglio di calcolo per gli abbonamenti, un gruppo WhatsApp per le iscrizioni, un promemoria di pagamento ogni mese e una tessera plastificata che nessuno porta con sé. Revel sostituisce tutto questo.',
			"I membri pagano un abbonamento mensile o annuale. La lezione settimanale è un evento riservato ai membri: chi vuole partecipare conferma, i dieci posti si riempiono, chi arriva dopo finisce in lista d'attesa, fine. Preferisci un pacchetto di lezioni? Vendi un pass per l'intera serie, solo per i membri, e ogni sessione è coperta. La tessera vive in Apple Wallet o Google Wallet, così il controllo all'ingresso è una semplice scansione.",
			'Funziona allo stesso modo per uno studio di yoga, una scuola di danza, un club di arrampicata, una società di canottaggio o un coro. E dato che Revel è open source e gratuito per gli eventi gratuiti, non paghi nulla finché non fai pagare davvero qualcosa.'
		]
	},
	features: [
		{
			icon: 'users',
			title: 'Livelli e piani di abbonamento',
			description:
				'Crea livelli come Base, Ridotto o Famiglia, ciascuno con piani mensili o annuali. I pagamenti passano da Stripe, oppure registri tu contanti e bonifici direttamente dalla dashboard.'
		},
		{
			icon: 'lock',
			title: 'Lezioni riservate ai membri',
			description:
				'Qualsiasi evento può essere riservato ai membri o a livelli specifici. Una lezione settimanale per dieci persone è un evento riservato ai membri, con una semplice conferma e una capienza di dieci posti.'
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
				"I membri aggiungono la tessera ad Apple Wallet o Google Wallet, oppure la scaricano in PDF. All'ingresso la verifichi con la scansione QR: nessuna tessera stampata."
		},
		{
			icon: 'clipboard',
			title: 'Questionari di approvazione',
			description:
				'Proteggi un livello con un breve questionario — una liberatoria, una verifica del livello, un codice di condotta — e approva in automatico, manualmente o in entrambi i modi.'
		},
		{
			icon: 'shield',
			title: 'Privato per impostazione predefinita',
			description:
				'I dati dei membri restano tuoi. Niente pubblicità, niente tracker, nessuna vendita della lista membri. Nativo GDPR e self-hostable se vuoi il controllo totale.'
		}
	],
	benefits: {
		title: 'Perché club e studi scelgono Revel',
		items: [
			"Pagamenti degli abbonamenti, iscrizioni alle lezioni e check-in all'ingresso in un unico posto",
			'Lezioni ricorrenti riservate ai membri con una semplice conferma e una capienza fissa',
			'I pass per la serie valgono come pacchetti di lezioni, corsi e abbonamenti stagionali',
			'Tessere in Apple Wallet e Google Wallet',
			'Gratuito per eventi gratuiti e conferme; una piccola commissione solo quando gestiamo noi un pagamento',
			'Open source e self-hostable: il tuo club non resta mai vincolato'
		]
	},
	cta: {
		title: 'Vuoi mandare in pensione il foglio di calcolo?',
		description:
			'Crea il tuo club in pochi minuti, oppure prova prima la demo. Nessuna carta di credito richiesta.',
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
				"Crea la lezione come evento ricorrente, imposta la visibilità come riservata ai membri e la capienza a dieci. I membri confermano dalla pagina dell'evento o dall'app; una volta occupati i dieci posti, le conferme successive finiscono in lista d'attesa. Niente biglietti, niente pagamenti, niente da riconciliare."
		},
		{
			question: 'Posso vendere un pacchetto di lezioni o un corso invece delle singole sessioni?',
			answer:
				'Sì. Un pass per la serie copre ogni evento di una serie — un corso di dieci settimane, un trimestre, una stagione. Scegli tu il prezzo e se riservarlo ai membri, e Revel lo sconta pro rata per le sessioni già passate.'
		},
		{
			question: "Come pagano l'abbonamento i membri?",
			answer:
				'Ogni livello può avere piani mensili o annuali pagati online tramite Stripe. Se il tuo club incassa in contanti o con bonifico, segna tu la quota associativa come pagata dalla dashboard: funziona con qualsiasi piano e non costa nulla.'
		},
		{
			question: 'Esiste una tessera fisica?',
			answer:
				"Ogni membro riceve una tessera digitale per Apple Wallet e Google Wallet, più un PDF scaricabile. All'ingresso, scansiona il codice QR con lo scanner di check-in di Revel per confermare che l'abbonamento è attivo."
		},
		{
			question: 'Quanto costa?',
			answer:
				'Nulla per eventi gratuiti, conferme e abbonamenti che gestisci manualmente. Quando Revel elabora un pagamento per te, si applica una piccola commissione (1,5% + 0,25 € per transazione). Il self-hosting è gratuito con licenza MIT.'
		},
		{
			question: 'Revel è solo per i club sportivi?',
			answer:
				'No. Gli stessi strumenti funzionano per studi di yoga e pilates, scuole di danza e musica, cori, palestre di arrampicata, società di canottaggio e ciclismo, makerspace e qualsiasi community che unisce un abbonamento a sessioni ricorrenti.'
		}
	],
	relatedPages: ['community-first-event-platform', 'eventbrite-alternative']
};

export const clubMembershipManagementFR: LandingPageContent = {
	slug: 'club-membership-management',
	locale: 'fr',
	meta: {
		title: 'Gestion des adhésions de club – Cours, pass et cartes | Revel',
		description:
			'Gestion des adhésions gratuite et open source pour salles de sport, studios de yoga, écoles de danse et chorales. Cours réservés aux membres, pass de série, carte wallet.',
		keywords:
			'gestion des adhérents, logiciel gestion de club, logiciel de gestion des adhésions, abonnement salle de sport, gestion studio de yoga, gestion club sportif, réservation de cours avec adhésion, événements réservés aux membres, carte de membre numérique'
	},
	hero: {
		headline: 'Gère un club, pas un tableur',
		subheadline:
			'Adhésions, cours réservés aux membres, pass de série et cartes dans le wallet, sur une seule plateforme gratuite et open source. Pensée pour la salle de sport de 50 membres comme pour la chorale de 500.'
	},
	intro: {
		paragraphs: [
			"Imagine une salle de sport de cinquante membres qui organise un cours hebdomadaire pour dix personnes. Aujourd'hui, ça veut dire un tableur pour les adhésions, un groupe WhatsApp pour les inscriptions, un rappel de paiement chaque mois et une carte plastifiée que personne n'a sur soi. Revel remplace tout ça.",
			"Les membres paient une adhésion mensuelle ou annuelle. Le cours hebdomadaire est un événement réservé aux membres : elles et ils s'inscrivent, les dix places se remplissent, le reste passe en liste d'attente, terminé. Tu préfères vendre un carnet de cours ? Propose un pass pour toute la série, réservé aux membres, et chaque séance est couverte. La carte de membre vit dans Apple Wallet ou Google Wallet : à l'entrée, un simple scan suffit.",
			"Ça marche exactement pareil pour un studio de yoga, une école de danse, un club d'escalade, un club d'aviron ou une chorale. Et comme Revel est open source et gratuit pour les événements gratuits, tu ne paies rien tant que tu ne factures rien."
		]
	},
	features: [
		{
			icon: 'users',
			title: "Niveaux d'adhésion et formules",
			description:
				'Crée des niveaux comme Membre, Étudiant ou Famille, chacun avec des formules mensuelles ou annuelles. Les paiements passent par Stripe, ou enregistre toi-même les espèces et les virements dans le tableau de bord.'
		},
		{
			icon: 'lock',
			title: 'Cours réservés aux membres',
			description:
				"N'importe quel événement peut être réservé aux membres ou à certains niveaux. Un cours hebdomadaire pour dix personnes, c'est un événement réservé aux membres avec une simple inscription et une capacité de dix."
		},
		{
			icon: 'ticket',
			title: 'Pass de série',
			description:
				'Vends un seul pass pour toute une série de séances, un cycle de cours ou une saison. Réserve-le aux membres si tu le souhaites. Les personnes qui rejoignent en cours de route paient automatiquement un prix au prorata.'
		},
		{
			icon: 'heart',
			title: 'Cartes de membre dans le wallet',
			description:
				"Les membres ajoutent leur carte à Apple Wallet ou Google Wallet, ou téléchargent un PDF. Contrôle-la à l'entrée avec le scanner QR, sans carte imprimée."
		},
		{
			icon: 'clipboard',
			title: "Questionnaires d'approbation",
			description:
				"Conditionne l'accès à un niveau par un court questionnaire (décharge, vérification de niveau, code de conduite) et approuve automatiquement, manuellement ou les deux."
		},
		{
			icon: 'shield',
			title: 'Privé par défaut',
			description:
				'Les données de tes membres restent les tiennes. Pas de publicité, pas de traceurs, pas de revente de ta liste de membres. Conforme au RGPD dès la conception, et auto-hébergeable si tu veux le contrôle total.'
		}
	],
	benefits: {
		title: 'Pourquoi les clubs et les studios choisissent Revel',
		items: [
			"Paiements des adhésions, inscriptions aux cours et contrôle à l'entrée au même endroit",
			'Cours récurrents réservés aux membres avec une simple inscription et une capacité ferme',
			"Des pass de série qui servent aussi de carnets de cours, de cycles et d'abonnements de saison",
			'Cartes de membre dans Apple Wallet et Google Wallet',
			'Gratuit pour les événements gratuits et les inscriptions ; une petite commission seulement quand nous traitons un paiement',
			"Open source et auto-hébergeable : ton club n'est jamais enfermé"
		]
	},
	cta: {
		title: 'Prêt à mettre le tableur à la retraite ?',
		description:
			"Crée ton club en quelques minutes, ou teste d'abord la démo. Aucune carte bancaire requise.",
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
				"Crée le cours comme un événement récurrent, règle sa visibilité sur « membres uniquement » et sa capacité sur dix. Les membres s'inscrivent depuis la page de l'événement ou l'application ; une fois les dix places prises, les inscriptions suivantes rejoignent la liste d'attente. Pas de billets, pas de paiements, rien à réconcilier."
		},
		{
			question: "Puis-je vendre un carnet de cours ou un cycle plutôt que des séances à l'unité ?",
			answer:
				"Oui. Un pass de série couvre tous les événements d'une série : un cycle de dix semaines, un trimestre, une saison. Tu choisis le prix, s'il est réservé aux membres ou non, et Revel applique automatiquement une remise au prorata pour les séances déjà passées."
		},
		{
			question: 'Comment les membres paient leur adhésion ?',
			answer:
				"Chaque niveau peut proposer des formules mensuelles ou annuelles payées en ligne via Stripe. Si ton club encaisse en espèces ou par virement, marque toi-même l'adhésion comme payée dans le tableau de bord : ça fonctionne avec toutes les formules et ne coûte rien."
		},
		{
			question: 'Y a-t-il une carte de membre physique ?',
			answer:
				"Chaque membre reçoit une carte numérique pour Apple Wallet et Google Wallet, plus un PDF téléchargeable. À l'entrée, scanne le QR code avec le scanner de check-in de Revel pour confirmer que l'adhésion est active."
		},
		{
			question: 'Combien ça coûte ?',
			answer:
				"Rien pour les événements gratuits, les inscriptions et les adhésions que tu gères manuellement. Quand Revel traite un paiement pour toi, une petite commission s'applique (1,5 % + 0,25 € par transaction). L'auto-hébergement est gratuit sous licence MIT."
		},
		{
			question: 'Revel est-il réservé aux clubs sportifs ?',
			answer:
				"Non. Les mêmes outils font tourner des studios de yoga et de pilates, des écoles de danse et de musique, des chorales, des salles d'escalade, des clubs d'aviron et de cyclisme, des fablabs et toute communauté qui combine une adhésion avec des séances récurrentes."
		}
	],
	relatedPages: ['community-first-event-platform', 'eventbrite-alternative']
};

export const clubMembershipManagementES: LandingPageContent = {
	slug: 'club-membership-management',
	locale: 'es',
	meta: {
		title: 'Gestión de Membresías para Clubes – Cuotas, Clases y Pases | Revel',
		description:
			'Gestión de membresías gratuita y open source para gimnasios, estudios de yoga, escuelas de baile y coros. Cuotas, clases solo para miembros, pases y carnets en el wallet.',
		keywords:
			'gestión de socios, software de gestión de membresías, software para gimnasios, membresías estudio de yoga, gestión de club deportivo, reserva de clases con membresía, eventos solo para miembros, carnet de miembro digital'
	},
	hero: {
		headline: 'Gestiona un Club, No una Hoja de Cálculo',
		subheadline:
			'Membresías, clases solo para miembros, pases de serie y carnets en el wallet en una sola plataforma gratuita y open source. Pensada tanto para el gimnasio con 50 miembros como para el coro con 500.'
	},
	intro: {
		paragraphs: [
			'Imagina un gimnasio con cincuenta miembros que organiza una clase semanal para diez personas. Hoy eso significa una hoja de cálculo de membresías, un grupo de WhatsApp para apuntarse, un recordatorio de pago cada mes y un carnet plastificado que nadie lleva encima. Revel lo sustituye todo.',
			'Los miembros pagan una cuota mensual o anual. La clase semanal es un evento solo para miembros: confirman asistencia, se llenan las diez plazas, el resto pasa a la lista de espera y listo. ¿Prefieres un bono de clases? Vende un pase para toda la serie, solo para miembros, y todas las sesiones quedan cubiertas. El carnet de miembro vive en Apple Wallet o Google Wallet, así que el control en la puerta es un simple escaneo.',
			'Funciona igual para un estudio de yoga, una escuela de baile, un club de escalada, un club de remo o un coro. Y como Revel es open source y gratuito para eventos gratuitos, no pagas nada hasta que realmente cobras por algo.'
		]
	},
	features: [
		{
			icon: 'users',
			title: 'Niveles de Membresía y Planes',
			description:
				'Crea niveles como Miembro, Estudiante o Familia, cada uno con cuotas mensuales o anuales. Los pagos pasan por Stripe, o registra tú los pagos en efectivo y las transferencias desde el panel.'
		},
		{
			icon: 'lock',
			title: 'Clases Solo para Miembros',
			description:
				'Cualquier evento puede restringirse a miembros o a niveles concretos. Una clase semanal para diez personas es un evento solo para miembros con una simple confirmación y un aforo de diez.'
		},
		{
			icon: 'ticket',
			title: 'Pases de Serie',
			description:
				'Vende un único pase para toda una serie de sesiones, un curso o una temporada. Restríngelo a miembros si quieres. Quien se incorpora tarde paga automáticamente un precio prorrateado.'
		},
		{
			icon: 'heart',
			title: 'Carnets de Miembro en el Wallet',
			description:
				'Los miembros añaden su carnet a Apple Wallet o Google Wallet, o descargan un PDF. Compruébalo en la puerta con el escáner QR, sin necesidad de carnet impreso.'
		},
		{
			icon: 'clipboard',
			title: 'Cuestionarios de Aprobación',
			description:
				'Protege un nivel con un breve cuestionario (una exención de responsabilidad, una prueba de nivel, un código de conducta) y aprueba de forma automática, manual o ambas.'
		},
		{
			icon: 'shield',
			title: 'Privado por Defecto',
			description:
				'Los datos de tus miembros siguen siendo tuyos. Sin anuncios, sin rastreadores, sin vender tu lista de miembros. Nativo RGPD y autoalojable si quieres control total.'
		}
	],
	benefits: {
		title: 'Por Qué los Clubes y Estudios Eligen Revel',
		items: [
			'Pagos de cuotas, inscripciones a clases y control en la puerta en un solo lugar',
			'Clases recurrentes solo para miembros con una simple confirmación y aforo limitado',
			'Los pases de serie sirven también como bonos de clases, cursos y abonos de temporada',
			'Carnets de miembro en Apple Wallet y Google Wallet',
			'Gratis para eventos gratuitos y confirmaciones; una pequeña comisión solo cuando procesamos un pago',
			'Open source y autoalojable, para que tu club nunca dependa de un solo proveedor'
		]
	},
	cta: {
		title: '¿Listo para Jubilar la Hoja de Cálculo?',
		description:
			'Crea tu club en minutos o prueba primero la demo. No se requiere tarjeta de crédito.',
		buttons: [
			{ text: 'Probar la Demo en Vivo', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Crear tu Club', href: '/register', variant: 'secondary' },
			{ text: 'Contáctanos', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: '¿Cómo funciona una clase semanal solo para miembros?',
			answer:
				'Crea la clase como evento recurrente, pon su visibilidad en solo para miembros y su aforo en diez. Los miembros confirman asistencia desde la página del evento o la app; cuando las diez plazas están ocupadas, las siguientes confirmaciones pasan a la lista de espera. Sin entradas, sin pagos, nada que cuadrar.'
		},
		{
			question: '¿Puedo vender un bono de clases o un curso en vez de sesiones sueltas?',
			answer:
				'Sí. Un pase de serie cubre todos los eventos de una serie: un curso de diez semanas, un trimestre, una temporada. Tú eliges el precio y si es solo para miembros, y Revel lo descuenta de forma prorrateada por las sesiones que ya se han celebrado.'
		},
		{
			question: '¿Cómo pagan los miembros su cuota?',
			answer:
				'Cada nivel puede tener cuotas mensuales o anuales que se pagan en línea a través de Stripe. Si tu club cobra en efectivo o por transferencia bancaria, marca tú la membresía como pagada desde el panel: funciona con cualquier plan y no cuesta nada.'
		},
		{
			question: '¿Hay un carnet de miembro físico?',
			answer:
				'Cada miembro recibe un carnet digital para Apple Wallet y Google Wallet, además de un PDF descargable. En la puerta, escanea el código QR con el escáner de check-in de Revel para confirmar que la membresía está activa.'
		},
		{
			question: '¿Cuánto cuesta?',
			answer:
				'Nada para eventos gratuitos, confirmaciones de asistencia y membresías que gestionas de forma manual. Cuando Revel procesa un pago por ti, se aplica una pequeña comisión (1,5 % + 0,25 € por transacción). Autoalojarlo es gratis bajo la licencia MIT.'
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
		title: 'Gestão de Membros para Clubes – Quotas, Aulas e Passes | Revel',
		description:
			'Gestão de membros gratuita e open source para ginásios, estúdios de yoga, escolas de dança, clubes e coros. Quotas, aulas só para membros, passes e cartão na wallet.',
		keywords:
			'gestão de sócios, gestão de membros, software de gestão de membros, software para ginásios, quotas estúdio de yoga, gestão de clube desportivo, marcação de aulas com quotas, eventos só para membros, cartão de membro digital'
	},
	hero: {
		headline: 'Gere um Clube, Não uma Folha de Cálculo',
		subheadline:
			'Quotas, aulas só para membros, passes de série e cartões na wallet numa única plataforma gratuita e open source. Feita para o ginásio com 50 membros e para o coro com 500.'
	},
	intro: {
		paragraphs: [
			'Imagina um ginásio com cinquenta membros que dá uma aula semanal para dez pessoas. Hoje isso significa uma folha de cálculo com as quotas, um grupo de WhatsApp para as inscrições, um lembrete de pagamento todos os meses e um cartão plastificado que ninguém traz consigo. O Revel substitui tudo isto.',
			'Os membros pagam uma quota mensal ou anual. A aula semanal é um evento só para membros: quem quer ir confirma, os dez lugares preenchem-se, o resto fica em lista de espera e está feito. Preferes um pacote de aulas? Vende um passe para toda a série, só para membros, e todas as sessões ficam cobertas. O cartão de membro vive na Apple Wallet ou na Google Wallet, por isso o controlo à porta é uma simples leitura de QR.',
			'Funciona exatamente da mesma forma para um estúdio de yoga, uma escola de dança, um clube de escalada, um clube de remo ou um coro. E como o Revel é open source e gratuito para eventos gratuitos, não pagas nada até cobrares realmente por alguma coisa.'
		]
	},
	features: [
		{
			icon: 'users',
			title: 'Escalões de Adesão e Planos',
			description:
				'Cria escalões como Membro, Estudante ou Família, cada um com quota mensal ou anual. Os pagamentos passam pela Stripe, ou regista tu no painel os pagamentos em dinheiro e por transferência.'
		},
		{
			icon: 'lock',
			title: 'Aulas Só Para Membros',
			description:
				'Qualquer evento pode ser restrito a membros ou a escalões específicos. Uma aula semanal para dez pessoas é um evento só para membros com uma simples confirmação e capacidade para dez.'
		},
		{
			icon: 'ticket',
			title: 'Passes de Série',
			description:
				'Vende um único passe para toda uma série de sessões, um curso ou uma temporada. Se quiseres, restringe-o a membros. Quem entra mais tarde paga automaticamente um preço proporcional.'
		},
		{
			icon: 'heart',
			title: 'Cartões de Membro na Wallet',
			description:
				'Os membros adicionam o cartão à Apple Wallet ou à Google Wallet, ou descarregam um PDF. Verifica-o à porta com o leitor de QR, sem cartão impresso.'
		},
		{
			icon: 'clipboard',
			title: 'Questionários de Aprovação',
			description:
				'Protege um escalão com um questionário curto — um termo de responsabilidade, uma verificação de nível, um código de conduta — e aprova de forma automática, manual ou ambas.'
		},
		{
			icon: 'shield',
			title: 'Privado por Defeito',
			description:
				'Os dados dos membros continuam a ser teus. Sem anúncios, sem rastreadores, sem venda da tua lista de membros. Nativo do RGPD e, se quiseres controlo total, podes alojá-lo tu.'
		}
	],
	benefits: {
		title: 'Porque É Que Clubes e Estúdios Escolhem o Revel',
		items: [
			'Pagamento de quotas, inscrições nas aulas e controlo à porta num só lugar',
			'Aulas recorrentes só para membros com uma simples confirmação e capacidade fixa',
			'Passes de série que servem de pacotes de aulas, cursos e bilhetes de temporada',
			'Cartões de membro na Apple Wallet e na Google Wallet',
			'Gratuito para eventos gratuitos e confirmações; uma pequena comissão só quando processamos um pagamento',
			'Open source e com alojamento próprio, para que o teu clube nunca fique preso'
		]
	},
	cta: {
		title: 'Queres Reformar a Folha de Cálculo?',
		description:
			'Cria o teu clube em minutos ou experimenta primeiro a demo. Não é necessário cartão de crédito.',
		buttons: [
			{
				text: 'Experimentar a Demo em Direto',
				href: 'https://demo.letsrevel.io',
				variant: 'primary'
			},
			{ text: 'Criar o Teu Clube', href: '/register', variant: 'secondary' },
			{ text: 'Contacta-nos', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Como funciona uma aula semanal só para membros?',
			answer:
				'Cria a aula como evento recorrente, define a visibilidade como só para membros e a capacidade como dez. Os membros confirmam a partir da página do evento ou da app; quando os dez lugares estiverem ocupados, as confirmações seguintes entram na lista de espera. Sem bilhetes, sem pagamentos, nada para conciliar.'
		},
		{
			question: 'Posso vender um pacote de aulas ou um curso em vez de sessões avulsas?',
			answer:
				'Sim. Um passe de série cobre todos os eventos de uma série — um curso de dez semanas, um trimestre, uma temporada. Escolhes o preço e se é só para membros, e o Revel desconta proporcionalmente as sessões que já aconteceram.'
		},
		{
			question: 'Como é que os membros pagam a quota?',
			answer:
				'Cada escalão pode ter quota mensal ou anual, paga online através da Stripe. Se o teu clube recebe em dinheiro ou por transferência bancária, marca tu a quota como paga no painel — funciona em qualquer plano e não custa nada.'
		},
		{
			question: 'Existe um cartão de membro físico?',
			answer:
				'Cada membro recebe um cartão digital para a Apple Wallet e a Google Wallet, além de um PDF para descarregar. À porta, lê o código QR com o leitor de check-in do Revel para confirmar que a adesão está ativa.'
		},
		{
			question: 'Quanto custa?',
			answer:
				'Nada para eventos gratuitos, confirmações e quotas que geres manualmente. Quando o Revel processa um pagamento por ti, aplica-se uma pequena comissão (1,5 % + 0,25 € por transação). O alojamento próprio é gratuito ao abrigo da licença MIT.'
		},
		{
			question: 'O Revel é só para clubes desportivos?',
			answer:
				'Não. As mesmas ferramentas servem estúdios de yoga e pilates, escolas de dança e de música, coros, ginásios de escalada, clubes de remo e de ciclismo, espaços maker e qualquer comunidade que combine uma adesão com sessões recorrentes.'
		}
	],
	relatedPages: ['community-first-event-platform', 'eventbrite-alternative']
};
