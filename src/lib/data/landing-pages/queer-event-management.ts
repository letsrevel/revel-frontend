import type { LandingPageContent } from './types';

export const queerEventManagementEN: LandingPageContent = {
	slug: 'queer-event-management',
	locale: 'en',
	meta: {
		title: 'Event Management for LGBTQ+ Communities | Revel',
		description:
			'Open-source event platform made by queer organizers. Attendee screening, private guest lists, pronouns built in, no trackers. Hosted in Europe or on your own server.',
		keywords:
			'lgbtq event platform, queer event management, gay event ticketing, pride events, queer community'
	},
	hero: {
		headline: 'Event Software Made by Queer Organizers',
		subheadline:
			'For the parties, drag nights, support groups and Pride weekends that mainstream platforms never quite got.'
	},
	intro: {
		paragraphs: [
			"Running queer events on mainstream platforms usually means working around them. Guest lists you can't hide. Nowhere to put pronouns. Content rules written with someone else in mind. And that nagging question of who can see who's coming.",
			"Revel grew out of queer community organizing in Europe. You can screen attendees with a questionnaire before they get a ticket, keep the guest list and the address hidden until you're ready, and let people share their pronouns if they want to.",
			"It's open source and free for free events. Use our hosted version, or run it on your own server."
		]
	},
	features: [
		{
			icon: 'clipboard',
			title: 'Screening Questionnaires',
			description:
				'Ask about your community guidelines, consent, or who can vouch for someone. Multiple-choice answers score automatically, and you review the rest.'
		},
		{
			icon: 'eye',
			title: 'Private Guest Lists',
			description:
				'Decide per event who sees the attendee list, the headcount and the address. Attendees can opt out of lists entirely.'
		},
		{
			icon: 'heart',
			title: 'Pronouns Built In',
			description:
				'Attendees can add pronouns to their profile, and you can ask for them on events where they matter.'
		},
		{
			icon: 'lock',
			title: 'Public, Private or Members Only',
			description:
				'List an event publicly, keep it unlisted, or open it only to your members or the people you invite.'
		},
		{
			icon: 'shield',
			title: 'Keep Unwanted People Out',
			description:
				'An organization blocklist that also catches spelling variations of names, plus direct invitations for guests you already trust.'
		},
		{
			icon: 'users',
			title: 'Community, Not Just Events',
			description:
				'Organizations, memberships, event series, announcements and potluck boards keep people coming back.'
		}
	],
	benefits: {
		title: 'Why Queer Organizers Use Revel',
		items: [
			'Screen attendees before they ever see the address',
			'Guest lists stay private unless you decide otherwise',
			'Pronouns are part of the profile, not an afterthought',
			'No trackers and no ad business behind the platform',
			'Self-host if you want nobody else holding your data',
			'Made by people who organize queer events themselves'
		]
	},
	cta: {
		title: 'Your Community Deserves Better Tools',
		description: 'Look around the demo, or start setting up your organization today.',
		buttons: [
			{ text: 'Try the Live Demo', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Self-Host (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Contact Us', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'How is Revel different from Eventbrite or Meetup?',
			answer:
				"Revel is built around privacy and screening. You can vet attendees, hide guest lists and addresses, and run members-only events, and nobody is showing your guests ads or tracking them. It's also open source, so you can run it yourself."
		},
		{
			question: 'Can I screen who attends my events?',
			answer:
				'Yes. Attach a questionnaire to an event and people answer it before they can get a ticket or RSVP. Multiple-choice questions score automatically, free-text answers you read yourself, and you approve or reject each submission.'
		},
		{
			question: "Who can see who's attending?",
			answer:
				'You decide per event whether attendees can see the guest list, the headcount and the address. Anyone can also hide themselves from attendee lists in their own settings.'
		},
		{
			question: 'Can I run members-only events?',
			answer:
				'Yes. Create an organization, add membership tiers, and make events members only. You can also reserve specific ticket tiers for specific membership tiers.'
		},
		{
			question: "Is our community's data safe?",
			answer:
				"We don't sell data and we don't use analytics trackers. The hosted version runs in Europe, and if you want full control, you can self-host."
		}
	],
	relatedPages: ['kink-event-ticketing', 'privacy-focused-events']
};

export const queerEventManagementDE: LandingPageContent = {
	slug: 'queer-event-management',
	locale: 'de',
	meta: {
		title: 'Event-Management für LGBTQ+ Communities | Revel',
		description:
			'Open-Source-Eventplattform von queeren Veranstalter*innen. Screening von Teilnehmer*innen, private Gästelisten, Pronomen eingebaut, keine Tracker. Gehostet in Europa oder auf deinem eigenen Server.',
		keywords:
			'lgbtq event plattform, queere events organisieren, queer event management, gay party tickets, pride events, queere community'
	},
	hero: {
		headline: 'Event-Software von queeren Veranstalter*innen',
		subheadline:
			'Für Partys, Drag-Nächte, Selbsthilfegruppen und Pride-Wochenenden, mit denen Mainstream-Plattformen nie so richtig klarkamen.'
	},
	intro: {
		paragraphs: [
			'Wer queere Events auf Mainstream-Plattformen organisiert, arbeitet meistens um sie herum. Gästelisten, die sich nicht verstecken lassen. Kein Platz für Pronomen. Inhaltsregeln, die für jemand anderen geschrieben wurden. Und immer diese nagende Frage, wer eigentlich sehen kann, wer alles kommt.',
			'Revel ist aus der queeren Community-Arbeit in Europa entstanden. Du kannst Teilnehmer*innen mit einem Fragebogen screenen, bevor sie ein Ticket bekommen, Gästeliste und Adresse verborgen halten, bis du so weit bist, und Leute ihre Pronomen angeben lassen, wenn sie das möchten.',
			'Revel ist Open Source und für kostenlose Events kostenlos. Nutze unsere gehostete Version oder betreibe Revel auf deinem eigenen Server.'
		]
	},
	features: [
		{
			icon: 'clipboard',
			title: 'Screening-Fragebögen',
			description:
				'Frag nach euren Community-Richtlinien, nach Consent oder danach, wer für jemanden bürgen kann. Multiple-Choice-Antworten werden automatisch bewertet, den Rest prüfst du selbst.'
		},
		{
			icon: 'eye',
			title: 'Private Gästelisten',
			description:
				'Leg pro Event fest, wer die Gästeliste, die Anzahl der Gäste und die Adresse sieht. Teilnehmer*innen können sich auch komplett aus allen Listen heraushalten.'
		},
		{
			icon: 'heart',
			title: 'Pronomen eingebaut',
			description:
				'Teilnehmer*innen können Pronomen in ihrem Profil angeben, und bei Events, wo es darauf ankommt, kannst du danach fragen.'
		},
		{
			icon: 'lock',
			title: 'Öffentlich, privat oder nur für Mitglieder',
			description:
				'Stell ein Event öffentlich ein, lass es ungelistet oder öffne es nur für deine Mitglieder oder die Leute, die du einlädst.'
		},
		{
			icon: 'shield',
			title: 'Unerwünschte Leute draußen halten',
			description:
				'Eine Sperrliste für deine Organisation, die auch abweichende Schreibweisen von Namen erkennt, dazu direkte Einladungen für Gäste, denen du schon vertraust.'
		},
		{
			icon: 'users',
			title: 'Community statt nur Events',
			description:
				'Organisationen, Mitgliedschaften, Eventreihen, Ankündigungen und Potluck-Listen sorgen dafür, dass Leute wiederkommen.'
		}
	],
	benefits: {
		title: 'Warum queere Veranstalter*innen Revel nutzen',
		items: [
			'Teilnehmer*innen screenen, bevor sie überhaupt die Adresse sehen',
			'Gästelisten bleiben privat, solange du nichts anderes entscheidest',
			'Pronomen gehören zum Profil und sind kein nachträglicher Einfall',
			'Keine Tracker und kein Werbegeschäft hinter der Plattform',
			'Selbst hosten, wenn niemand sonst deine Daten haben soll',
			'Gemacht von Leuten, die selbst queere Events organisieren'
		]
	},
	cta: {
		title: 'Deine Community verdient bessere Tools',
		description: 'Schau dich in der Demo um oder richte noch heute deine Organisation ein.',
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
			question: 'Was unterscheidet Revel von Eventbrite oder Meetup?',
			answer:
				'Bei Revel dreht sich alles um Privatsphäre und Screening. Du kannst Teilnehmer*innen prüfen, Gästelisten und Adressen verbergen und Events nur für Mitglieder veranstalten, und niemand zeigt deinen Gästen Werbung oder trackt sie. Außerdem ist Revel Open Source, du kannst es also selbst betreiben.'
		},
		{
			question: 'Kann ich prüfen, wer zu meinen Events kommt?',
			answer:
				'Ja. Häng einen Fragebogen an ein Event, und die Leute beantworten ihn, bevor sie ein Ticket bekommen oder per RSVP zusagen können. Multiple-Choice-Fragen werden automatisch bewertet, Freitextantworten liest du selbst, und du nimmst jede Einreichung an oder lehnst sie ab.'
		},
		{
			question: 'Wer kann sehen, wer kommt?',
			answer:
				'Du legst pro Event fest, ob Teilnehmer*innen die Gästeliste, die Anzahl der Gäste und die Adresse sehen können. Außerdem kann sich jede Person in ihren eigenen Einstellungen aus Teilnehmer*innenlisten ausblenden.'
		},
		{
			question: 'Kann ich Events nur für Mitglieder veranstalten?',
			answer:
				'Ja. Erstelle eine Organisation, lege Mitgliedschaftsstufen an und mach Events nur für Mitglieder zugänglich. Du kannst auch bestimmte Ticketstufen für bestimmte Mitgliedschaftsstufen reservieren.'
		},
		{
			question: 'Sind die Daten unserer Community sicher?',
			answer:
				'Wir verkaufen keine Daten und nutzen keine Analyse-Tracker. Die gehostete Version läuft in Europa, und wenn du volle Kontrolle willst, kannst du Revel selbst hosten.'
		}
	],
	relatedPages: ['kink-event-ticketing', 'privacy-focused-events']
};

export const queerEventManagementIT: LandingPageContent = {
	slug: 'queer-event-management',
	locale: 'it',
	meta: {
		title: 'Gestione eventi per community LGBTQ+ | Revel',
		description:
			'Piattaforma eventi open source creata da chi organizza eventi queer. Screening delle persone partecipanti, liste ospiti private, pronomi integrati, nessun tracker. Ospitata in Europa o sul tuo server.',
		keywords:
			'piattaforma eventi lgbtq, organizzare eventi queer, gestione eventi queer, biglietti serate gay, eventi pride, community queer'
	},
	hero: {
		headline: 'Software per eventi fatto da chi organizza eventi queer',
		subheadline:
			'Per le feste, le serate drag, i gruppi di supporto e i weekend del Pride che le piattaforme mainstream non hanno mai capito davvero.'
	},
	intro: {
		paragraphs: [
			'Organizzare eventi queer sulle piattaforme mainstream di solito vuol dire arrangiarsi. Liste ospiti che non puoi nascondere. Nessuno spazio per i pronomi. Regole sui contenuti scritte pensando a qualcun altro. E quel dubbio che non se ne va mai: chi può vedere chi viene?',
			"Revel nasce dall'organizzazione di community queer in Europa. Puoi fare lo screening delle persone partecipanti con un questionario prima che ricevano un biglietto, tenere nascosti la lista ospiti e l'indirizzo finché non lo decidi tu, e lasciare che ognuno condivida i propri pronomi, se vuole.",
			'È open source e gratuito per gli eventi gratuiti. Usa la nostra versione hosted o installalo sul tuo server.'
		]
	},
	features: [
		{
			icon: 'clipboard',
			title: 'Questionari di screening',
			description:
				'Chiedi delle linee guida della tua community, del consenso o di chi può garantire per qualcuno. Le risposte a scelta multipla ricevono un punteggio automatico, il resto lo valuti tu.'
		},
		{
			icon: 'eye',
			title: 'Liste ospiti private',
			description:
				"Decidi per ogni evento chi vede la lista delle persone partecipanti, il numero di presenze e l'indirizzo. Chi partecipa può anche escludersi del tutto dalle liste."
		},
		{
			icon: 'heart',
			title: 'Pronomi integrati',
			description:
				'Chi partecipa può aggiungere i pronomi al proprio profilo, e puoi chiederli negli eventi in cui contano.'
		},
		{
			icon: 'lock',
			title: 'Pubblico, privato o solo per membri',
			description:
				'Rendi un evento pubblico, tienilo fuori dagli elenchi o aprilo solo ai tuoi membri o alle persone che inviti.'
		},
		{
			icon: 'shield',
			title: 'Tieni fuori chi non vuoi',
			description:
				"Una lista nera dell'organizzazione che riconosce anche le varianti di scrittura dei nomi, più inviti diretti per gli ospiti di cui ti fidi già."
		},
		{
			icon: 'users',
			title: 'Community, non solo eventi',
			description:
				'Organizzazioni, membership, serie di eventi, annunci e bacheche potluck fanno tornare le persone.'
		}
	],
	benefits: {
		title: 'Perché chi organizza eventi queer usa Revel',
		items: [
			"Fai lo screening delle persone partecipanti prima ancora che vedano l'indirizzo",
			'Le liste ospiti restano private, a meno che tu non decida altrimenti',
			"I pronomi fanno parte del profilo, non sono un'aggiunta dell'ultimo minuto",
			'Nessun tracker e nessun business pubblicitario dietro la piattaforma',
			'Puoi fare self-hosting se non vuoi che i tuoi dati finiscano in mano ad altri',
			'Fatto da persone che organizzano eventi queer in prima persona'
		]
	},
	cta: {
		title: 'La tua community merita strumenti migliori',
		description: "Dai un'occhiata alla demo o inizia oggi a configurare la tua organizzazione.",
		buttons: [
			{ text: 'Prova la demo live', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Self-hosting (GitHub)', href: 'https://github.com/letsrevel', variant: 'secondary' },
			{ text: 'Contattaci', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'In cosa Revel è diverso da Eventbrite o Meetup?',
			answer:
				'Revel è costruito attorno a privacy e screening. Puoi selezionare le persone partecipanti, nascondere liste ospiti e indirizzi e organizzare eventi solo per membri, e nessuno traccia chi partecipa né gli mostra pubblicità. È anche open source, quindi puoi installarlo tu.'
		},
		{
			question: 'Posso selezionare chi partecipa ai miei eventi?',
			answer:
				'Sì. Collega un questionario a un evento e le persone rispondono prima di poter ottenere un biglietto o fare RSVP. Le domande a scelta multipla ricevono un punteggio automatico, le risposte libere le leggi tu, e approvi o rifiuti ogni risposta.'
		},
		{
			question: 'Chi può vedere chi partecipa?',
			answer:
				"Decidi per ogni evento se le persone partecipanti possono vedere la lista ospiti, il numero di presenze e l'indirizzo. Inoltre chiunque può nascondersi dalle liste partecipanti nelle proprie impostazioni."
		},
		{
			question: 'Posso organizzare eventi solo per membri?',
			answer:
				"Sì. Crea un'organizzazione, aggiungi dei livelli di membership e rendi gli eventi riservati ai membri. Puoi anche riservare specifici tipi di biglietto a specifici livelli di membership."
		},
		{
			question: 'I dati della nostra community sono al sicuro?',
			answer:
				'Non vendiamo dati e non usiamo tracker di analisi. La versione hosted gira in Europa e, se vuoi il pieno controllo, puoi fare self-hosting.'
		}
	],
	relatedPages: ['kink-event-ticketing', 'privacy-focused-events']
};

export const queerEventManagementFR: LandingPageContent = {
	slug: 'queer-event-management',
	locale: 'fr',
	meta: {
		title: 'Gestion d’événements pour les communautés LGBTQ+ | Revel',
		description:
			'Plateforme d’événements open source créée par des organisateur·rices queer. Sélection des participant·es, listes privées, pronoms intégrés, aucun traceur. Hébergée en Europe ou sur ton propre serveur.',
		keywords:
			'plateforme événements lgbtq, organiser soirée queer, gestion événements queer, billetterie soirée gay, événements pride, communauté queer'
	},
	hero: {
		headline: 'Un logiciel d’événements créé par des organisateur·rices queer',
		subheadline:
			'Pour les soirées, les nuits drag, les groupes de soutien et les week-ends de la Pride que les plateformes grand public n’ont jamais vraiment compris.'
	},
	intro: {
		paragraphs: [
			'Organiser des événements queer sur les plateformes grand public, c’est souvent passer son temps à les contourner. Des listes de participant·es impossibles à masquer. Aucun endroit pour les pronoms. Des règles de contenu écrites pour d’autres. Et cette question qui ne te lâche pas : qui peut voir qui vient ?',
			'Revel est né de l’organisation communautaire queer en Europe. Tu peux faire remplir un questionnaire de sélection aux personnes avant qu’elles obtiennent un billet, garder la liste des personnes inscrites et l’adresse cachées jusqu’au moment que tu choisis, et laisser chaque personne indiquer ses pronoms si elle le souhaite.',
			'C’est open source et gratuit pour les événements gratuits. Utilise notre version hébergée ou fais-le tourner sur ton propre serveur.'
		]
	},
	features: [
		{
			icon: 'clipboard',
			title: 'Questionnaires de sélection',
			description:
				'Pose des questions sur les règles de ta communauté, le consentement ou les personnes qui peuvent se porter garantes de quelqu’un. Les réponses à choix multiples sont notées automatiquement, et tu examines le reste.'
		},
		{
			icon: 'eye',
			title: 'Listes de participant·es privées',
			description:
				'Choisis pour chaque événement qui voit la liste des personnes inscrites, le nombre de participant·es et l’adresse. Chaque personne peut aussi choisir de n’apparaître dans aucune liste.'
		},
		{
			icon: 'heart',
			title: 'Pronoms intégrés',
			description:
				'Chaque personne peut ajouter ses pronoms à son profil, et tu peux les demander pour les événements où ils comptent.'
		},
		{
			icon: 'lock',
			title: 'Public, privé ou réservé aux membres',
			description:
				'Publie un événement pour tout le monde, garde-le non répertorié ou ouvre-le uniquement à tes membres ou aux personnes que tu invites.'
		},
		{
			icon: 'shield',
			title: 'Tiens les indésirables à l’écart',
			description:
				'Une liste noire à l’échelle de l’organisation qui repère aussi les variantes d’orthographe des noms, et des invitations directes pour les personnes en qui tu as déjà confiance.'
		},
		{
			icon: 'users',
			title: 'Une communauté, pas seulement des événements',
			description:
				'Organisations, adhésions, séries d’événements, annonces et tableaux de potluck donnent envie aux gens de revenir.'
		}
	],
	benefits: {
		title: 'Pourquoi les organisateur·rices queer utilisent Revel',
		items: [
			'Filtre les inscriptions avant que quiconque voie l’adresse',
			'Les listes restent privées, sauf si tu en décides autrement',
			'Les pronoms font partie du profil, ce n’est pas un ajout de dernière minute',
			'Aucun traceur et aucun business publicitaire derrière la plateforme',
			'Auto-héberge Revel si tu ne veux confier tes données à personne',
			'Conçu par des personnes qui organisent elles-mêmes des événements queer'
		]
	},
	cta: {
		title: 'Ta communauté mérite de meilleurs outils',
		description: 'Explore la démo ou commence à configurer ton organisation dès aujourd’hui.',
		buttons: [
			{ text: 'Tester la démo en direct', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{
				text: 'Héberger soi-même (GitHub)',
				href: 'https://github.com/letsrevel',
				variant: 'secondary'
			},
			{ text: 'Nous contacter', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'En quoi Revel est-il différent d’Eventbrite ou de Meetup ?',
			answer:
				'Revel est construit autour de la confidentialité et de la sélection. Tu peux filtrer les inscriptions, masquer les listes de participant·es et les adresses, et organiser des événements réservés aux membres, sans que personne ne cible ton public avec de la pub ni ne le piste. Revel est aussi open source, donc tu peux l’héberger toi-même.'
		},
		{
			question: 'Puis-je filtrer qui participe à mes événements ?',
			answer:
				'Oui. Associe un questionnaire à un événement : les personnes y répondent avant de pouvoir obtenir un billet ou confirmer leur présence. Les questions à choix multiples sont notées automatiquement, tu lis toi-même les réponses libres, et tu approuves ou refuses chaque soumission.'
		},
		{
			question: 'Qui peut voir qui participe ?',
			answer:
				'Tu choisis pour chaque événement si les personnes inscrites peuvent voir la liste, le nombre de participant·es et l’adresse. Chaque personne peut aussi se retirer des listes de participant·es dans ses propres paramètres.'
		},
		{
			question: 'Puis-je organiser des événements réservés aux membres ?',
			answer:
				'Oui. Crée une organisation, ajoute des niveaux d’adhésion et réserve tes événements aux membres. Tu peux aussi réserver certains types de billet à certains niveaux d’adhésion.'
		},
		{
			question: 'Les données de notre communauté sont-elles en sécurité ?',
			answer:
				'Nous ne vendons pas de données et n’utilisons aucun traceur analytique. La version hébergée tourne en Europe, et si tu veux garder le contrôle total, tu peux l’auto-héberger.'
		}
	],
	relatedPages: ['kink-event-ticketing', 'privacy-focused-events']
};

export const queerEventManagementES: LandingPageContent = {
	slug: 'queer-event-management',
	locale: 'es',
	meta: {
		title: 'Gestión de eventos para comunidades LGBTQ+ | Revel',
		description:
			'Plataforma de eventos de código abierto hecha por quienes organizan eventos queer. Selección de asistentes, listas privadas, pronombres integrados, sin rastreadores. Alojada en Europa o en tu propio servidor.',
		keywords:
			'plataforma eventos lgtbi, organizar eventos queer, gestión de eventos queer, entradas fiestas gay, eventos del orgullo, comunidad lgtbi'
	},
	hero: {
		headline: 'Software de eventos hecho por quienes organizan eventos queer',
		subheadline:
			'Para las fiestas, las noches drag, los grupos de apoyo y los fines de semana del Orgullo que las plataformas convencionales nunca terminaron de entender.'
	},
	intro: {
		paragraphs: [
			'Organizar eventos queer en plataformas convencionales suele significar ir sorteando sus limitaciones. Listas de asistentes que no puedes ocultar. Ningún sitio para los pronombres. Normas de contenido escritas pensando en otra gente. Y esa duda que nunca se va: ¿quién puede ver quién va a venir?',
			'Revel nació de la organización comunitaria queer en Europa. Puedes filtrar a las personas asistentes con un cuestionario antes de que consigan su entrada, mantener ocultas la lista de asistentes y la dirección hasta que tú lo decidas, y dejar que cada persona comparta sus pronombres si quiere.',
			'Es de código abierto y gratis para eventos gratuitos. Usa nuestra versión alojada o instálalo en tu propio servidor.'
		]
	},
	features: [
		{
			icon: 'clipboard',
			title: 'Cuestionarios de selección',
			description:
				'Pregunta por las normas de tu comunidad, el consentimiento o quién puede avalar a alguien. Las respuestas de opción múltiple se puntúan solas y el resto lo revisas tú.'
		},
		{
			icon: 'eye',
			title: 'Listas de asistentes privadas',
			description:
				'Decide en cada evento quién ve la lista de asistentes, el número de personas y la dirección. Las personas asistentes también pueden quedarse fuera de las listas por completo.'
		},
		{
			icon: 'heart',
			title: 'Pronombres integrados',
			description:
				'Las personas asistentes pueden añadir sus pronombres al perfil, y puedes pedirlos en los eventos donde importan.'
		},
		{
			icon: 'lock',
			title: 'Público, privado o solo para miembros',
			description:
				'Publica un evento abiertamente, déjalo sin listar o ábrelo solo a tus miembros o a las personas que invites.'
		},
		{
			icon: 'shield',
			title: 'Deja fuera a quien no quieres',
			description:
				'Una lista negra de la organización que también detecta variantes en la escritura de los nombres, además de invitaciones directas para las personas en las que ya confías.'
		},
		{
			icon: 'users',
			title: 'Comunidad, no solo eventos',
			description:
				'Organizaciones, membresías, series de eventos, anuncios y tablones de potluck hacen que la gente vuelva.'
		}
	],
	benefits: {
		title: 'Por qué quienes organizan eventos queer usan Revel',
		items: [
			'Filtra a las personas asistentes antes de que vean la dirección',
			'Las listas de asistentes son privadas salvo que decidas lo contrario',
			'Los pronombres forman parte del perfil, no son un añadido de última hora',
			'Sin rastreadores ni negocio publicitario detrás de la plataforma',
			'Aloja tu propia instancia si no quieres que nadie más guarde tus datos',
			'Hecho por gente que también organiza eventos queer'
		]
	},
	cta: {
		title: 'Tu comunidad merece mejores herramientas',
		description: 'Echa un vistazo a la demo o empieza hoy mismo a configurar tu organización.',
		buttons: [
			{ text: 'Probar la demo en vivo', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{
				text: 'Alojar tu propia instancia (GitHub)',
				href: 'https://github.com/letsrevel',
				variant: 'secondary'
			},
			{ text: 'Contáctanos', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: '¿En qué se diferencia Revel de Eventbrite o Meetup?',
			answer:
				'Revel está construido en torno a la privacidad y la selección. Puedes filtrar a las personas asistentes, ocultar listas y direcciones y organizar eventos solo para miembros, y nadie le muestra anuncios a tu gente ni la rastrea. Además es de código abierto, así que puedes alojarlo tú.'
		},
		{
			question: '¿Puedo filtrar quién asiste a mis eventos?',
			answer:
				'Sí. Añade un cuestionario a un evento y la gente lo responde antes de poder conseguir una entrada o confirmar asistencia. Las preguntas de opción múltiple se puntúan solas, las respuestas de texto libre las lees tú, y apruebas o rechazas cada envío.'
		},
		{
			question: '¿Quién puede ver quién asiste?',
			answer:
				'Tú decides en cada evento si las personas asistentes pueden ver la lista, el número de personas y la dirección. Además, cualquiera puede ocultarse de las listas de asistentes desde su propia configuración.'
		},
		{
			question: '¿Puedo organizar eventos solo para miembros?',
			answer:
				'Sí. Crea una organización, añade niveles de membresía y haz que los eventos sean solo para miembros. También puedes reservar tipos de entrada concretos para niveles de membresía concretos.'
		},
		{
			question: '¿Están seguros los datos de nuestra comunidad?',
			answer:
				'No vendemos datos ni usamos rastreadores de analítica. La versión alojada funciona en Europa y, si quieres control total, puedes alojarlo tú.'
		}
	],
	relatedPages: ['kink-event-ticketing', 'privacy-focused-events']
};

export const queerEventManagementPT: LandingPageContent = {
	slug: 'queer-event-management',
	locale: 'pt',
	meta: {
		title: 'Gestão de eventos para comunidades LGBTQ+ | Revel',
		description:
			'Plataforma de eventos open source feita por quem organiza eventos queer. Seleção de participantes, listas privadas, pronomes integrados, sem rastreadores. Alojada na Europa ou no teu próprio servidor.',
		keywords:
			'plataforma eventos lgbt, organizar eventos queer, gestão de eventos queer, bilhetes festas gay, eventos orgulho, comunidade queer portugal'
	},
	hero: {
		headline: 'Software de eventos feito por quem organiza eventos queer',
		subheadline:
			'Para as festas, as noites drag, os grupos de apoio e os fins de semana do Orgulho que as plataformas convencionais nunca perceberam bem.'
	},
	intro: {
		paragraphs: [
			'Organizar eventos queer em plataformas convencionais costuma obrigar a contornar as suas limitações. Listas de participantes que não dá para esconder. Nenhum sítio para os pronomes. Regras de conteúdo escritas a pensar noutras pessoas. E aquela dúvida que nunca desaparece: quem consegue ver quem vai?',
			'A Revel nasceu da organização comunitária queer na Europa. Podes fazer a seleção das pessoas participantes com um questionário antes de receberem bilhete, manter a lista de participantes e a morada escondidas até decidires mostrá-las, e deixar cada pessoa partilhar os seus pronomes, se quiser.',
			'É open source e gratuita para eventos gratuitos. Usa a nossa versão alojada ou instala-a no teu próprio servidor.'
		]
	},
	features: [
		{
			icon: 'clipboard',
			title: 'Questionários de seleção',
			description:
				'Pergunta pelas regras da tua comunidade, pelo consentimento ou por quem pode responder por alguém. As respostas de escolha múltipla são pontuadas automaticamente e o resto revês tu.'
		},
		{
			icon: 'eye',
			title: 'Listas de participantes privadas',
			description:
				'Decide, evento a evento, quem vê a lista de participantes, o número de pessoas e a morada. Quem participa pode ainda ficar fora das listas por completo.'
		},
		{
			icon: 'heart',
			title: 'Pronomes integrados',
			description:
				'Quem participa pode adicionar pronomes ao perfil, e podes pedi-los nos eventos em que fazem diferença.'
		},
		{
			icon: 'lock',
			title: 'Público, privado ou só para membros',
			description:
				'Publica um evento para toda a gente, mantém-no fora das listagens ou abre-o apenas aos teus membros ou às pessoas que convidares.'
		},
		{
			icon: 'shield',
			title: 'Mantém longe quem não queres',
			description:
				'Uma lista negra da organização que também apanha variações na escrita dos nomes, e ainda convites diretos para as pessoas em quem já confias.'
		},
		{
			icon: 'users',
			title: 'Comunidade, não só eventos',
			description:
				'Organizações, adesões, séries de eventos, anúncios e quadros de potluck fazem as pessoas voltar.'
		}
	],
	benefits: {
		title: 'Porque é que quem organiza eventos queer usa a Revel',
		items: [
			'Faz a seleção de quem participa antes de verem a morada',
			'As listas de participantes ficam privadas, a não ser que decidas o contrário',
			'Os pronomes fazem parte do perfil, não são um pormenor de última hora',
			'Sem rastreadores e sem negócio de publicidade por trás da plataforma',
			'Alojamento próprio, se não quiseres os teus dados nas mãos de mais ninguém',
			'Feita por pessoas que também organizam eventos queer'
		]
	},
	cta: {
		title: 'A tua comunidade merece ferramentas melhores',
		description: 'Explora a demo ou começa hoje a configurar a tua organização.',
		buttons: [
			{
				text: 'Experimentar a demo ao vivo',
				href: 'https://demo.letsrevel.io',
				variant: 'primary'
			},
			{
				text: 'Alojamento próprio (GitHub)',
				href: 'https://github.com/letsrevel',
				variant: 'secondary'
			},
			{ text: 'Contacta-nos', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'O que distingue a Revel do Eventbrite ou do Meetup?',
			answer:
				'A Revel foi construída em torno da privacidade e da seleção. Podes selecionar quem participa, esconder listas e moradas e organizar eventos só para membros, e ninguém mostra publicidade a quem vai aos teus eventos nem lhes segue o rasto. Além disso, é open source, por isso podes ser tu a alojá-la.'
		},
		{
			question: 'Posso escolher quem vai aos meus eventos?',
			answer:
				'Sim. Associa um questionário a um evento e as pessoas respondem antes de poderem obter bilhete ou confirmar presença. As perguntas de escolha múltipla são pontuadas automaticamente, as respostas de texto livre lês tu, e aprovas ou rejeitas cada submissão.'
		},
		{
			question: 'Quem consegue ver quem vai?',
			answer:
				'Decides, evento a evento, se as pessoas participantes podem ver a lista, o número de pessoas e a morada. Além disso, qualquer pessoa pode esconder-se das listas de participantes nas suas próprias definições.'
		},
		{
			question: 'Posso organizar eventos só para membros?',
			answer:
				'Sim. Cria uma organização, adiciona níveis de adesão e torna os eventos exclusivos para membros. Também podes reservar tipos de bilhete específicos para níveis de adesão específicos.'
		},
		{
			question: 'Os dados da nossa comunidade estão seguros?',
			answer:
				'Não vendemos dados nem usamos rastreadores de análise. A versão alojada funciona na Europa e, se quiseres controlo total, podes optar pelo alojamento próprio.'
		}
	],
	relatedPages: ['kink-event-ticketing', 'privacy-focused-events']
};
