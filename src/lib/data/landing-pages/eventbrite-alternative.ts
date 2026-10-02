import type { LandingPageContent } from './types';

export const eventbriteAlternativeEN: LandingPageContent = {
	slug: 'eventbrite-alternative',
	locale: 'en',
	meta: {
		title: 'Eventbrite Alternative with Lower Fees and No Lock-In | Revel',
		description:
			'Revel is an open-source Eventbrite alternative. 1.5% + €0.25 per transaction, free events stay free, and you can import your Eventbrite events in a few clicks. Or self-host it.',
		keywords:
			'eventbrite alternative, import from eventbrite, low fee ticketing, cheap event ticketing, open source ticketing, event platform'
	},
	hero: {
		headline: 'Keep More of Every Ticket',
		subheadline:
			'Revel is the open-source Eventbrite alternative. Simple fees, payouts straight to your own Stripe account, and your events come with you.'
	},
	intro: {
		paragraphs: [
			"Switching ticketing platforms sounds like a weekend lost to copy and paste. It isn't. Connect your Eventbrite account and Revel pulls in your upcoming events as drafts, ticket types included: prices, quantities and sales windows. Check them over, connect Stripe, publish.",
			"The pricing fits in a sentence. Free events and RSVPs cost nothing. For paid tickets we take 1.5% + €0.25 per transaction, once per checkout rather than per ticket, plus Stripe's usual processing fee. The money goes straight into your own Stripe account, so you're never waiting on us for a payout. Selling at the door or by bank transfer? No platform fee on those either.",
			"Revel is open source under the MIT license. If you'd rather run it on your own server, you can, and then there's no platform fee at all."
		]
	},
	features: [
		{
			icon: 'euro',
			title: 'Fees You Can Explain',
			description:
				'1.5% + €0.25 per transaction on paid tickets, charged once per checkout. Free events, RSVPs and offline sales cost nothing.'
		},
		{
			icon: 'globe',
			title: 'Bring Your Eventbrite Events',
			description:
				'Connect your account and import upcoming events as drafts, with venue and ticket types carried over. You can also push Revel events to Eventbrite while you switch.'
		},
		{
			icon: 'ticket',
			title: 'Proper Ticketing',
			description:
				'Multiple tiers, pay-what-you-can pricing, discount codes, waitlists, reserved seating, and guest checkout without an account.'
		},
		{
			icon: 'check',
			title: 'Easy Door Check-In',
			description:
				'Scan QR codes from any phone browser. Attendees get their ticket in Apple Wallet, Google Wallet or as a PDF.'
		},
		{
			icon: 'clipboard',
			title: 'Invoices and VAT Sorted',
			description:
				'Automatic invoices for buyers, VAT IDs checked against VIES, credit notes for refunds, and a revenue report for your accountant.'
		},
		{
			icon: 'code',
			title: 'Open Source (MIT)',
			description:
				"Read the code, run it on your own server, change what you need. Your events aren't at the mercy of someone else's next price change."
		}
	],
	benefits: {
		title: 'Why Organizers Switch',
		items: [
			'Payouts land directly in your own Stripe account',
			'Import upcoming events and ticket types from Eventbrite instead of retyping them',
			'Tickets sold on Eventbrite show up on the linked tier, so running both for a while stays manageable',
			'Export your attendee list to Excel whenever you want',
			'No ads and no trackers on your event pages',
			'Available in English, German, Italian, French, Spanish and Portuguese'
		]
	},
	cta: {
		title: 'Ready to Switch?',
		description:
			'Look around the demo, or create your organization and import your first event. No credit card needed.',
		buttons: [
			{ text: 'Try the Live Demo', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Create Your Organization', href: '/register', variant: 'secondary' },
			{ text: 'Contact Us', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: "How does Revel's pricing compare to Eventbrite?",
			answer:
				"On our hosted version you pay 1.5% + €0.25 per transaction on paid tickets, plus Stripe's processing fee. The fixed part is charged once per checkout, so someone buying four tickets doesn't cost you four times €0.25. Free events, RSVPs and tickets paid offline carry no platform fee at all. Put that next to what Eventbrite charges in your country, and keep in mind that self-hosting Revel removes our fee entirely."
		},
		{
			question: 'Can I move my events over from Eventbrite?',
			answer:
				"Yes. Connect your Eventbrite account in your organization's admin area and pick the upcoming events you want. Each one arrives as a draft with its description, dates, venue and ticket types. Paid tiers stay paused until your Stripe account is connected, so nothing goes on sale by accident. Attendees and past orders stay on Eventbrite, since Revel doesn't import them."
		},
		{
			question: 'Can I keep selling on Eventbrite while I switch?',
			answer:
				'Yes. You can push a Revel event and its ticket tiers to Eventbrite, publish it there, and pause individual tiers whenever you like. Tickets sold on Eventbrite come back as external sales on the matching tier, so you see the whole picture in one place.'
		},
		{
			question: 'Do my attendees need an account?',
			answer:
				"Not if you don't want them to. Turn on guest checkout for an event and people can get their tickets with just an email address."
		},
		{
			question: 'Is Revel really free to self-host?',
			answer:
				"Yes. It's MIT licensed, so you can run it on your own server without paying us anything. You cover your hosting and, if you sell tickets online, Stripe's fees. A small server with 2 vCPUs and 4 GB of RAM is enough to start."
		},
		{
			question: 'Where does the hosted version run?',
			answer: 'On servers in Europe. If you self-host, you decide where your data lives.'
		}
	],
	relatedPages: [
		'self-hosted-event-platform',
		'privacy-focused-events',
		'club-membership-management'
	]
};

export const eventbriteAlternativeDE: LandingPageContent = {
	slug: 'eventbrite-alternative',
	locale: 'de',
	meta: {
		title: 'Eventbrite-Alternative mit niedrigen Gebühren und ohne Lock-in | Revel',
		description:
			'Revel ist eine Open-Source-Alternative zu Eventbrite. 1,5% + 0,25€ pro Transaktion, kostenlose Events bleiben kostenlos, und deine Eventbrite-Events importierst du mit wenigen Klicks. Oder du hostest Revel selbst.',
		keywords:
			'eventbrite alternative, eventbrite-alternative, von eventbrite importieren, ticketing niedrige gebühren, günstiges event ticketing, open source ticketing, ticketverkauf veranstaltung, eventplattform'
	},
	hero: {
		headline: 'Behalte mehr von jedem Ticket',
		subheadline:
			'Revel ist die Open-Source-Alternative zu Eventbrite. Einfache Gebühren, Auszahlungen direkt auf dein eigenes Stripe-Konto, und deine Events ziehen einfach mit um.'
	},
	intro: {
		paragraphs: [
			'Die Ticketing-Plattform zu wechseln klingt nach einem Wochenende voller Copy-and-paste. Ist es aber nicht. Verbinde dein Eventbrite-Konto, und Revel holt deine anstehenden Events als Entwürfe rüber, samt Ticketkategorien: Preise, Kontingente und Verkaufszeiträume. Kurz drüberschauen, Stripe verbinden, veröffentlichen.',
			'Die Preise passen in einen Satz. Kostenlose Events und RSVPs kosten nichts. Für bezahlte Tickets nehmen wir 1,5% + 0,25€ pro Transaktion, einmal pro Bestellung statt pro Ticket, plus die üblichen Stripe-Gebühren. Das Geld landet direkt auf deinem eigenen Stripe-Konto, du wartest also nie auf eine Auszahlung von uns. Du verkaufst an der Abendkasse oder per Überweisung? Auch dafür fällt keine Plattformgebühr an.',
			'Revel ist Open Source unter der MIT-Lizenz. Wenn du es lieber auf deinem eigenen Server betreibst, geht das auch, und dann gibt es überhaupt keine Plattformgebühr.'
		]
	},
	features: [
		{
			icon: 'euro',
			title: 'Gebühren, die du erklären kannst',
			description:
				'1,5% + 0,25€ pro Transaktion bei bezahlten Tickets, einmal pro Bestellung berechnet. Kostenlose Events, RSVPs und Offline-Verkäufe kosten nichts.'
		},
		{
			icon: 'globe',
			title: 'Nimm deine Eventbrite-Events mit',
			description:
				'Verbinde dein Konto und importiere anstehende Events als Entwürfe, inklusive Veranstaltungsort und Ticketkategorien. Während des Umstiegs kannst du Revel-Events auch zu Eventbrite übertragen.'
		},
		{
			icon: 'ticket',
			title: 'Richtiges Ticketing',
			description:
				'Mehrere Ticketkategorien, Preise nach dem Prinzip „Zahl, was du kannst“, Rabattcodes, Wartelisten, feste Sitzplätze und Gast-Checkout ohne Konto.'
		},
		{
			icon: 'check',
			title: 'Entspannter Check-in am Einlass',
			description:
				'QR-Codes mit jedem Handy-Browser scannen. Teilnehmer*innen bekommen ihr Ticket in Apple Wallet, Google Wallet oder als PDF.'
		},
		{
			icon: 'clipboard',
			title: 'Rechnungen und Umsatzsteuer erledigt',
			description:
				'Automatische Rechnungen für Käufer*innen, USt-IdNr. per VIES geprüft, Gutschriften bei Erstattungen und ein Umsatzbericht für deine Buchhaltung.'
		},
		{
			icon: 'code',
			title: 'Open Source (MIT)',
			description:
				'Lies den Code, betreib ihn auf deinem eigenen Server, ändere, was du brauchst. Deine Events sind nicht der nächsten Preiserhöhung von jemand anderem ausgeliefert.'
		}
	],
	benefits: {
		title: 'Warum Veranstalter*innen wechseln',
		items: [
			'Auszahlungen landen direkt auf deinem eigenen Stripe-Konto',
			'Anstehende Events und Ticketkategorien aus Eventbrite importieren, statt alles abzutippen',
			'Auf Eventbrite verkaufte Tickets erscheinen bei der verknüpften Ticketkategorie, so bleibt es überschaubar, wenn du eine Weile beides parallel nutzt',
			'Exportiere deine Teilnehmer*innenliste jederzeit nach Excel',
			'Keine Werbung und keine Tracker auf deinen Eventseiten',
			'Verfügbar auf Englisch, Deutsch, Italienisch, Französisch, Spanisch und Portugiesisch'
		]
	},
	cta: {
		title: 'Bereit zum Wechseln?',
		description:
			'Schau dich in der Demo um oder erstelle deine Organisation und importiere dein erstes Event. Keine Kreditkarte nötig.',
		buttons: [
			{ text: 'Live-Demo ausprobieren', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Organisation erstellen', href: '/register', variant: 'secondary' },
			{ text: 'Kontakt', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Wie schneiden Revels Preise im Vergleich zu Eventbrite ab?',
			answer:
				'In unserer gehosteten Version zahlst du 1,5% + 0,25€ pro Transaktion bei bezahlten Tickets, plus die Stripe-Gebühren. Der feste Anteil wird einmal pro Bestellung berechnet: Wer vier Tickets kauft, kostet dich also nicht viermal 0,25€. Für kostenlose Events, RSVPs und offline bezahlte Tickets fällt gar keine Plattformgebühr an. Vergleich das mit dem, was Eventbrite in deinem Land verlangt, und denk daran, dass unsere Gebühr komplett wegfällt, wenn du Revel selbst hostest.'
		},
		{
			question: 'Kann ich meine Events von Eventbrite rüberholen?',
			answer:
				'Ja. Verbinde dein Eventbrite-Konto im Adminbereich deiner Organisation und wähle die anstehenden Events aus, die du übernehmen willst. Jedes kommt als Entwurf an, mit Beschreibung, Terminen, Veranstaltungsort und Ticketkategorien. Bezahlte Kategorien bleiben pausiert, bis dein Stripe-Konto verbunden ist, damit nichts aus Versehen in den Verkauf geht. Teilnehmer*innen und vergangene Bestellungen bleiben auf Eventbrite, denn Revel importiert sie nicht.'
		},
		{
			question: 'Kann ich während des Wechsels weiter auf Eventbrite verkaufen?',
			answer:
				'Ja. Du kannst ein Revel-Event samt Ticketkategorien zu Eventbrite übertragen, es dort veröffentlichen und einzelne Kategorien pausieren, wann immer du willst. Auf Eventbrite verkaufte Tickets kommen als externe Verkäufe bei der passenden Kategorie zurück, so hast du alles an einem Ort im Blick.'
		},
		{
			question: 'Brauchen meine Teilnehmer*innen ein Konto?',
			answer:
				'Nicht, wenn du das nicht willst. Aktiviere für ein Event den Gast-Checkout, dann bekommen Leute ihre Tickets allein mit ihrer E-Mail-Adresse.'
		},
		{
			question: 'Ist Revel beim Selbst-Hosten wirklich kostenlos?',
			answer:
				'Ja. Revel steht unter der MIT-Lizenz, du kannst es also auf deinem eigenen Server betreiben, ohne uns etwas zu zahlen. Du trägst die Hosting-Kosten und, wenn du online Tickets verkaufst, die Stripe-Gebühren. Für den Anfang reicht ein kleiner Server mit 2 vCPUs und 4 GB RAM.'
		},
		{
			question: 'Wo läuft die gehostete Version?',
			answer:
				'Auf Servern in Europa. Wenn du selbst hostest, entscheidest du, wo deine Daten liegen.'
		}
	],
	relatedPages: [
		'self-hosted-event-platform',
		'privacy-focused-events',
		'club-membership-management'
	]
};

export const eventbriteAlternativeIT: LandingPageContent = {
	slug: 'eventbrite-alternative',
	locale: 'it',
	meta: {
		title: 'Alternativa a Eventbrite con commissioni basse e nessun vincolo | Revel',
		description:
			"Revel è un'alternativa open source a Eventbrite. 1,5% + €0,25 per transazione, gli eventi gratuiti restano gratuiti e importi i tuoi eventi Eventbrite in pochi clic. Oppure lo installi sul tuo server.",
		keywords:
			'alternativa eventbrite, alternativa a eventbrite, importare eventi da eventbrite, biglietteria online commissioni basse, vendita biglietti eventi economica, biglietteria open source, piattaforma eventi'
	},
	hero: {
		headline: 'Tieni per te di più su ogni biglietto',
		subheadline:
			"Revel è l'alternativa open source a Eventbrite. Commissioni semplici, incassi direttamente sul tuo account Stripe, e i tuoi eventi vengono con te."
	},
	intro: {
		paragraphs: [
			'Cambiare piattaforma di biglietteria sembra un weekend perso a fare copia e incolla. Non lo è. Collega il tuo account Eventbrite e Revel importa i tuoi prossimi eventi come bozze, tipi di biglietto compresi: prezzi, quantità e periodi di vendita. Dai una controllata, collega Stripe, pubblica.',
			"I prezzi stanno in una frase. Eventi gratuiti e RSVP non costano nulla. Sui biglietti a pagamento prendiamo l'1,5% + €0,25 per transazione, una volta per acquisto e non per biglietto, più la normale commissione di Stripe. I soldi arrivano direttamente sul tuo account Stripe, quindi non aspetti mai un nostro versamento. Vendi all'ingresso o con bonifico? Anche lì nessuna commissione di piattaforma.",
			'Revel è open source con licenza MIT. Se preferisci farlo girare sul tuo server puoi farlo, e a quel punto non c’è nessuna commissione di piattaforma.'
		]
	},
	features: [
		{
			icon: 'euro',
			title: 'Commissioni che sai spiegare',
			description:
				'1,5% + €0,25 per transazione sui biglietti a pagamento, addebitati una volta per acquisto. Eventi gratuiti, RSVP e vendite offline non costano nulla.'
		},
		{
			icon: 'globe',
			title: 'Porta con te i tuoi eventi Eventbrite',
			description:
				'Collega il tuo account e importa i prossimi eventi come bozze, con luogo e tipi di biglietto già inclusi. Mentre fai il passaggio puoi anche pubblicare gli eventi Revel su Eventbrite.'
		},
		{
			icon: 'ticket',
			title: 'Una biglietteria come si deve',
			description:
				'Più tipi di biglietto, prezzi a offerta libera, codici sconto, liste d’attesa, posti assegnati e acquisto come ospite senza account.'
		},
		{
			icon: 'check',
			title: "Check-in facile all'ingresso",
			description:
				'Scansiona i QR code da qualsiasi browser del telefono. Le persone partecipanti ricevono il biglietto su Apple Wallet, Google Wallet o in PDF.'
		},
		{
			icon: 'clipboard',
			title: 'Fatture e IVA sistemate',
			description:
				'Fatture automatiche per chi acquista, partite IVA verificate tramite VIES, note di credito per i rimborsi e un report dei ricavi per chi ti tiene la contabilità.'
		},
		{
			icon: 'code',
			title: 'Open source (MIT)',
			description:
				'Leggi il codice, fallo girare sul tuo server, cambia quello che ti serve. I tuoi eventi non sono in balia del prossimo aumento di prezzo deciso da qualcun altro.'
		}
	],
	benefits: {
		title: 'Perché chi organizza eventi cambia',
		items: [
			'Gli incassi arrivano direttamente sul tuo account Stripe',
			'Importa prossimi eventi e tipi di biglietto da Eventbrite invece di riscriverli a mano',
			'I biglietti venduti su Eventbrite compaiono nel tipo di biglietto collegato, così usare entrambe le piattaforme per un po’ resta gestibile',
			'Esporta la lista delle persone partecipanti in Excel quando vuoi',
			'Niente pubblicità e niente tracker sulle pagine dei tuoi eventi',
			'Disponibile in inglese, tedesco, italiano, francese, spagnolo e portoghese'
		]
	},
	cta: {
		title: 'È ora di cambiare?',
		description:
			'Dai un’occhiata alla demo, oppure crea la tua organizzazione e importa il tuo primo evento. Nessuna carta di credito richiesta.',
		buttons: [
			{ text: 'Prova la demo live', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Crea la tua organizzazione', href: '/register', variant: 'secondary' },
			{ text: 'Contattaci', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Come si confrontano i prezzi di Revel con quelli di Eventbrite?',
			answer:
				"Sulla versione hosted paghi l'1,5% + €0,25 per transazione sui biglietti a pagamento, più la commissione di Stripe. La parte fissa viene addebitata una volta per acquisto, quindi chi compra quattro biglietti non ti costa quattro volte 0,25€. Eventi gratuiti, RSVP e biglietti pagati offline non hanno nessuna commissione di piattaforma. Mettilo a confronto con quello che Eventbrite chiede nel tuo paese, e ricorda che se installi Revel sul tuo server la nostra commissione sparisce del tutto."
		},
		{
			question: 'Posso spostare i miei eventi da Eventbrite?',
			answer:
				"Sì. Collega il tuo account Eventbrite nell'area di amministrazione della tua organizzazione e scegli i prossimi eventi che ti interessano. Ognuno arriva come bozza, con descrizione, date, luogo e tipi di biglietto. I biglietti a pagamento restano in pausa finché non colleghi il tuo account Stripe, così niente finisce in vendita per sbaglio. Le persone partecipanti e gli ordini passati restano su Eventbrite, perché Revel non li importa."
		},
		{
			question: 'Posso continuare a vendere su Eventbrite mentre faccio il passaggio?',
			answer:
				'Sì. Puoi pubblicare un evento Revel e i suoi tipi di biglietto su Eventbrite, metterlo online lì e sospendere i singoli tipi di biglietto quando vuoi. I biglietti venduti su Eventbrite tornano come vendite esterne nel tipo di biglietto corrispondente, così hai il quadro completo in un unico posto.'
		},
		{
			question: 'Le persone che partecipano devono avere un account?',
			answer:
				"Non se non vuoi. Attiva l'acquisto come ospite per un evento e le persone possono prendere i biglietti solo con un indirizzo email."
		},
		{
			question: 'Revel è davvero gratis se lo installo sul mio server?',
			answer:
				"Sì. Ha licenza MIT, quindi puoi farlo girare sul tuo server senza pagarci nulla. Tu copri l'hosting e, se vendi biglietti online, le commissioni di Stripe. Per iniziare basta un piccolo server con 2 vCPU e 4 GB di RAM."
		},
		{
			question: 'Dove gira la versione hosted?',
			answer: 'Su server in Europa. Se lo installi tu, decidi tu dove stanno i tuoi dati.'
		}
	],
	relatedPages: [
		'self-hosted-event-platform',
		'privacy-focused-events',
		'club-membership-management'
	]
};

export const eventbriteAlternativeES: LandingPageContent = {
	slug: 'eventbrite-alternative',
	locale: 'es',
	meta: {
		title: 'Alternativa a Eventbrite con comisiones bajas y sin ataduras | Revel',
		description:
			'Revel es una alternativa de código abierto a Eventbrite. 1,5 % + 0,25 € por transacción, los eventos gratuitos siguen siendo gratis y puedes importar tus eventos de Eventbrite en unos pocos clics. O alojarlo en tu propio servidor.',
		keywords:
			'alternativa a eventbrite, eventbrite alternative, importar eventos de eventbrite, venta de entradas comisiones bajas, venta de entradas barata, ticketing de código abierto, plataforma de eventos'
	},
	hero: {
		headline: 'Quédate con más de cada entrada',
		subheadline:
			'Revel es la alternativa de código abierto a Eventbrite. Comisiones sencillas, cobros directos en tu propia cuenta de Stripe, y tus eventos se vienen contigo.'
	},
	intro: {
		paragraphs: [
			'Cambiar de plataforma de venta de entradas suena a un fin de semana perdido copiando y pegando. Pues no. Conecta tu cuenta de Eventbrite y Revel trae tus próximos eventos como borradores, con los tipos de entrada incluidos: precios, cantidades y periodos de venta. Échales un vistazo, conecta Stripe y publica.',
			'Los precios caben en una frase. Los eventos gratuitos y las confirmaciones de asistencia no cuestan nada. En las entradas de pago cobramos 1,5 % + 0,25 € por transacción, una vez por compra y no por entrada, más la comisión habitual de Stripe. El dinero va directo a tu propia cuenta de Stripe, así que nunca tienes que esperar a que te paguemos. ¿Vendes en taquilla o por transferencia bancaria? Ahí tampoco hay comisión de plataforma.',
			'Revel es de código abierto con licencia MIT. Si prefieres ejecutarlo en tu propio servidor, puedes hacerlo, y entonces no hay ninguna comisión de plataforma.'
		]
	},
	features: [
		{
			icon: 'euro',
			title: 'Comisiones que puedes explicar',
			description:
				'1,5 % + 0,25 € por transacción en entradas de pago, cobrado una vez por compra. Los eventos gratuitos, las confirmaciones de asistencia y las ventas offline no cuestan nada.'
		},
		{
			icon: 'globe',
			title: 'Tráete tus eventos de Eventbrite',
			description:
				'Conecta tu cuenta e importa tus próximos eventos como borradores, con el lugar y los tipos de entrada incluidos. Mientras haces el cambio, también puedes publicar eventos de Revel en Eventbrite.'
		},
		{
			icon: 'ticket',
			title: 'Venta de entradas en serio',
			description:
				'Varios tipos de entrada, precio libre (paga lo que puedas), códigos de descuento, listas de espera, asientos numerados y compra sin necesidad de cuenta.'
		},
		{
			icon: 'check',
			title: 'Control de acceso sin complicaciones',
			description:
				'Escanea códigos QR desde el navegador de cualquier móvil. Las personas asistentes reciben su entrada en Apple Wallet, Google Wallet o en PDF.'
		},
		{
			icon: 'clipboard',
			title: 'Facturas e IVA resueltos',
			description:
				'Facturas automáticas para quien compra, NIF-IVA comprobados en VIES, facturas rectificativas para los reembolsos y un informe de ingresos para tu gestoría.'
		},
		{
			icon: 'code',
			title: 'Código abierto (MIT)',
			description:
				'Lee el código, ejecútalo en tu propio servidor y cambia lo que necesites. Tus eventos no quedan a merced de la próxima subida de precios de otros.'
		}
	],
	benefits: {
		title: 'Por qué quienes organizan eventos se cambian',
		items: [
			'Los cobros llegan directamente a tu propia cuenta de Stripe',
			'Importa tus próximos eventos y tipos de entrada desde Eventbrite en lugar de volver a escribirlos',
			'Las entradas vendidas en Eventbrite aparecen en el tipo de entrada vinculado, así que usar ambas plataformas durante un tiempo sigue siendo manejable',
			'Exporta la lista de personas asistentes a Excel cuando quieras',
			'Sin anuncios ni rastreadores en las páginas de tus eventos',
			'Disponible en inglés, alemán, italiano, francés, español y portugués'
		]
	},
	cta: {
		title: '¿Hora de cambiar?',
		description:
			'Echa un vistazo a la demo, o crea tu organización e importa tu primer evento. No hace falta tarjeta de crédito.',
		buttons: [
			{ text: 'Probar la demo en vivo', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Crear tu organización', href: '/register', variant: 'secondary' },
			{ text: 'Contáctanos', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: '¿Cómo se comparan los precios de Revel con los de Eventbrite?',
			answer:
				'En nuestra versión alojada pagas 1,5 % + 0,25 € por transacción en las entradas de pago, más la comisión de Stripe. La parte fija se cobra una vez por compra, así que si alguien compra cuatro entradas no te cuesta cuatro veces 0,25 €. Los eventos gratuitos, las confirmaciones de asistencia y las entradas pagadas offline no tienen ninguna comisión de plataforma. Compáralo con lo que cobra Eventbrite en tu país, y ten en cuenta que si alojas Revel por tu cuenta, nuestra comisión desaparece por completo.'
		},
		{
			question: '¿Puedo traer mis eventos desde Eventbrite?',
			answer:
				'Sí. Conecta tu cuenta de Eventbrite en el área de administración de tu organización y elige los próximos eventos que quieras. Cada uno llega como borrador, con su descripción, fechas, lugar y tipos de entrada. Los tipos de entrada de pago quedan en pausa hasta que conectes tu cuenta de Stripe, para que nada salga a la venta por error. Las personas asistentes y los pedidos anteriores se quedan en Eventbrite, porque Revel no los importa.'
		},
		{
			question: '¿Puedo seguir vendiendo en Eventbrite mientras me cambio?',
			answer:
				'Sí. Puedes enviar un evento de Revel y sus tipos de entrada a Eventbrite, publicarlo allí y pausar tipos de entrada concretos cuando quieras. Las entradas vendidas en Eventbrite vuelven como ventas externas en el tipo de entrada correspondiente, así que lo ves todo en un solo sitio.'
		},
		{
			question: '¿Las personas asistentes necesitan una cuenta?',
			answer:
				'No, si no quieres. Activa la compra sin cuenta en un evento y cualquiera podrá conseguir su entrada solo con una dirección de correo electrónico.'
		},
		{
			question: '¿De verdad es gratis alojar Revel por tu cuenta?',
			answer:
				'Sí. Tiene licencia MIT, así que puedes ejecutarlo en tu propio servidor sin pagarnos nada. Tú cubres el alojamiento y, si vendes entradas online, las comisiones de Stripe. Para empezar basta con un servidor pequeño con 2 vCPU y 4 GB de RAM.'
		},
		{
			question: '¿Dónde funciona la versión alojada?',
			answer: 'En servidores en Europa. Si lo alojas tú, decides dónde viven tus datos.'
		}
	],
	relatedPages: [
		'self-hosted-event-platform',
		'privacy-focused-events',
		'club-membership-management'
	]
};

export const eventbriteAlternativePT: LandingPageContent = {
	slug: 'eventbrite-alternative',
	locale: 'pt',
	meta: {
		title: 'Alternativa ao Eventbrite com taxas baixas e sem amarras | Revel',
		description:
			'A Revel é uma alternativa open-source ao Eventbrite. 1,5 % + 0,25 € por transação, os eventos gratuitos continuam gratuitos e podes importar os teus eventos do Eventbrite em poucos cliques. Ou alojá-la no teu próprio servidor.',
		keywords:
			'alternativa ao eventbrite, eventbrite alternative, importar eventos do eventbrite, bilhética com taxas baixas, venda de bilhetes barata, bilhética open source, plataforma de eventos'
	},
	hero: {
		headline: 'Fica com mais de cada bilhete',
		subheadline:
			'A Revel é a alternativa open-source ao Eventbrite. Taxas simples, pagamentos diretamente na tua própria conta Stripe, e os teus eventos vêm contigo.'
	},
	intro: {
		paragraphs: [
			'Mudar de plataforma de bilhética parece um fim de semana perdido a copiar e colar. Não é. Liga a tua conta do Eventbrite e a Revel traz os teus próximos eventos como rascunhos, com os tipos de bilhete incluídos: preços, quantidades e períodos de venda. Dá-lhes uma vista de olhos, liga o Stripe e publica.',
			'Os preços cabem numa frase. Eventos gratuitos e confirmações de presença não custam nada. Nos bilhetes pagos cobramos 1,5 % + 0,25 € por transação, uma vez por compra e não por bilhete, mais a taxa habitual da Stripe. O dinheiro vai diretamente para a tua própria conta Stripe, por isso nunca ficas à espera de um pagamento nosso. Vendes à porta ou por transferência bancária? Aí também não há taxa de plataforma.',
			'A Revel é open-source com licença MIT. Se preferires corrê-la no teu próprio servidor, podes, e aí não há taxa de plataforma nenhuma.'
		]
	},
	features: [
		{
			icon: 'euro',
			title: 'Taxas que consegues explicar',
			description:
				'1,5 % + 0,25 € por transação nos bilhetes pagos, cobrado uma vez por compra. Eventos gratuitos, confirmações de presença e vendas offline não custam nada.'
		},
		{
			icon: 'globe',
			title: 'Traz os teus eventos do Eventbrite',
			description:
				'Liga a tua conta e importa os próximos eventos como rascunhos, com o local e os tipos de bilhete incluídos. Enquanto fazes a mudança, também podes enviar eventos da Revel para o Eventbrite.'
		},
		{
			icon: 'ticket',
			title: 'Bilhética a sério',
			description:
				'Vários tipos de bilhete, preço livre (paga o que puderes), códigos de desconto, listas de espera, lugares marcados e compra sem conta.'
		},
		{
			icon: 'check',
			title: 'Check-in à porta sem complicações',
			description:
				'Lê códigos QR a partir do browser de qualquer telemóvel. As pessoas participantes recebem o bilhete na Apple Wallet, na Google Wallet ou em PDF.'
		},
		{
			icon: 'clipboard',
			title: 'Faturas e IVA tratados',
			description:
				'Faturas automáticas para quem compra, números de IVA verificados no VIES, notas de crédito para os reembolsos e um relatório de receitas para a tua contabilidade.'
		},
		{
			icon: 'code',
			title: 'Código aberto (MIT)',
			description:
				'Lê o código, corre-o no teu próprio servidor, muda o que precisares. Os teus eventos não ficam à mercê do próximo aumento de preços de outra pessoa.'
		}
	],
	benefits: {
		title: 'Porque é que quem organiza eventos muda',
		items: [
			'Os pagamentos chegam diretamente à tua própria conta Stripe',
			'Importa os próximos eventos e tipos de bilhete do Eventbrite em vez de os escreveres de novo',
			'Os bilhetes vendidos no Eventbrite aparecem no tipo de bilhete associado, por isso usar as duas plataformas durante algum tempo continua a ser fácil de gerir',
			'Exporta a lista de pessoas participantes para Excel sempre que quiseres',
			'Sem anúncios e sem rastreadores nas páginas dos teus eventos',
			'Disponível em inglês, alemão, italiano, francês, espanhol e português'
		]
	},
	cta: {
		title: 'Hora de mudar?',
		description:
			'Explora a demo, ou cria a tua organização e importa o teu primeiro evento. Não é preciso cartão de crédito.',
		buttons: [
			{
				text: 'Experimentar a demo ao vivo',
				href: 'https://demo.letsrevel.io',
				variant: 'primary'
			},
			{ text: 'Criar a tua organização', href: '/register', variant: 'secondary' },
			{ text: 'Contacta-nos', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Como é que os preços da Revel se comparam aos do Eventbrite?',
			answer:
				'Na nossa versão alojada pagas 1,5 % + 0,25 € por transação nos bilhetes pagos, mais a taxa da Stripe. A parte fixa é cobrada uma vez por compra, por isso alguém que compre quatro bilhetes não te custa quatro vezes 0,25 €. Eventos gratuitos, confirmações de presença e bilhetes pagos offline não têm qualquer taxa de plataforma. Compara isto com o que o Eventbrite cobra no teu país, e lembra-te de que, se alojares a Revel por tua conta, a nossa taxa desaparece por completo.'
		},
		{
			question: 'Posso trazer os meus eventos do Eventbrite?',
			answer:
				'Sim. Liga a tua conta do Eventbrite na área de administração da tua organização e escolhe os próximos eventos que queres. Cada um chega como rascunho, com descrição, datas, local e tipos de bilhete. Os tipos de bilhete pagos ficam em pausa até ligares a tua conta Stripe, para que nada fique à venda por engano. As pessoas participantes e as encomendas anteriores ficam no Eventbrite, porque a Revel não as importa.'
		},
		{
			question: 'Posso continuar a vender no Eventbrite enquanto faço a mudança?',
			answer:
				'Sim. Podes enviar um evento da Revel e os seus tipos de bilhete para o Eventbrite, publicá-lo lá e pausar tipos de bilhete individuais sempre que quiseres. Os bilhetes vendidos no Eventbrite voltam como vendas externas no tipo de bilhete correspondente, por isso vês tudo num só lugar.'
		},
		{
			question: 'As pessoas participantes precisam de uma conta?',
			answer:
				'Não, se não quiseres. Ativa a compra sem conta num evento e as pessoas podem obter os bilhetes só com um endereço de email.'
		},
		{
			question: 'Alojar a Revel por conta própria é mesmo gratuito?',
			answer:
				'Sim. Tem licença MIT, por isso podes corrê-la no teu próprio servidor sem nos pagar nada. Tu pagas o alojamento e, se venderes bilhetes online, as taxas da Stripe. Para começar, chega um servidor pequeno com 2 vCPU e 4 GB de RAM.'
		},
		{
			question: 'Onde corre a versão alojada?',
			answer:
				'Em servidores na Europa. Se alojares por tua conta, és tu que decides onde ficam os teus dados.'
		}
	],
	relatedPages: [
		'self-hosted-event-platform',
		'privacy-focused-events',
		'club-membership-management'
	]
};

export const eventbriteAlternativeFR: LandingPageContent = {
	slug: 'eventbrite-alternative',
	locale: 'fr',
	meta: {
		title: 'Alternative à Eventbrite avec des frais bas et sans engagement | Revel',
		description:
			'Revel est une alternative open source à Eventbrite. 1,5 % + 0,25 € par transaction, les événements gratuits restent gratuits et tu importes tes événements Eventbrite en quelques clics. Ou tu l’héberges toi-même.',
		keywords:
			'alternative eventbrite, alternative à eventbrite, importer depuis eventbrite, billetterie frais réduits, billetterie pas chère, billetterie open source, plateforme événementielle'
	},
	hero: {
		headline: 'Garde une plus grande part de chaque billet',
		subheadline:
			'Revel est l’alternative open source à Eventbrite. Des frais simples, des versements directement sur ton propre compte Stripe, et tes événements te suivent.'
	},
	intro: {
		paragraphs: [
			'Changer de plateforme de billetterie, ça ressemble à un week-end perdu en copier-coller. En fait, non. Connecte ton compte Eventbrite et Revel récupère tes événements à venir sous forme de brouillons, catégories de billets comprises : prix, quantités et périodes de vente. Tu vérifies, tu connectes Stripe, tu publies.',
			'Les tarifs tiennent en une phrase. Les événements gratuits et les RSVP ne coûtent rien. Pour les billets payants, on prend 1,5 % + 0,25 € par transaction, une fois par commande et non par billet, plus les frais habituels de Stripe. L’argent arrive directement sur ton propre compte Stripe, tu n’attends donc jamais un versement de notre part. Tu vends à l’entrée ou par virement ? Pas de frais de plateforme là-dessus non plus.',
			'Revel est open source sous licence MIT. Si tu préfères le faire tourner sur ton propre serveur, c’est possible, et il n’y a alors plus aucuns frais de plateforme.'
		]
	},
	features: [
		{
			icon: 'euro',
			title: 'Des frais faciles à expliquer',
			description:
				'1,5 % + 0,25 € par transaction sur les billets payants, prélevés une fois par commande. Les événements gratuits, les RSVP et les ventes hors ligne ne coûtent rien.'
		},
		{
			icon: 'globe',
			title: 'Emmène tes événements Eventbrite',
			description:
				'Connecte ton compte et importe tes événements à venir sous forme de brouillons, avec le lieu et les catégories de billets. Pendant la transition, tu peux aussi publier des événements Revel sur Eventbrite.'
		},
		{
			icon: 'ticket',
			title: 'Une vraie billetterie',
			description:
				'Plusieurs catégories de billets, prix libre, codes de réduction, listes d’attente, places numérotées et achat sans compte.'
		},
		{
			icon: 'check',
			title: 'Un contrôle à l’entrée tout simple',
			description:
				'Scanne les QR codes depuis le navigateur de n’importe quel téléphone. Les participant·es reçoivent leur billet dans Apple Wallet, Google Wallet ou en PDF.'
		},
		{
			icon: 'clipboard',
			title: 'Factures et TVA, c’est réglé',
			description:
				'Factures automatiques pour les personnes qui achètent, numéros de TVA vérifiés via VIES, avoirs pour les remboursements et un rapport de recettes pour ta comptabilité.'
		},
		{
			icon: 'code',
			title: 'Open source (MIT)',
			description:
				'Lis le code, fais-le tourner sur ton propre serveur, modifie ce dont tu as besoin. Tes événements ne sont pas à la merci de la prochaine hausse de prix décidée par quelqu’un d’autre.'
		}
	],
	benefits: {
		title: 'Pourquoi les organisateur·rices changent',
		items: [
			'Les versements arrivent directement sur ton propre compte Stripe',
			'Importe tes événements à venir et tes catégories de billets depuis Eventbrite au lieu de tout ressaisir',
			'Les billets vendus sur Eventbrite apparaissent dans la catégorie liée, donc utiliser les deux plateformes pendant un temps reste gérable',
			'Exporte ta liste de participant·es vers Excel quand tu veux',
			'Ni publicité ni traqueurs sur les pages de tes événements',
			'Disponible en anglais, allemand, italien, français, espagnol et portugais'
		]
	},
	cta: {
		title: 'Prêt·e à changer ?',
		description:
			'Fais un tour sur la démo, ou crée ton organisation et importe ton premier événement. Aucune carte bancaire requise.',
		buttons: [
			{ text: 'Tester la démo en direct', href: 'https://demo.letsrevel.io', variant: 'primary' },
			{ text: 'Créer ton organisation', href: '/register', variant: 'secondary' },
			{ text: 'Nous contacter', href: 'mailto:contact@letsrevel.io', variant: 'outline' }
		]
	},
	faq: [
		{
			question: 'Comment les tarifs de Revel se comparent-ils à ceux d’Eventbrite ?',
			answer:
				'Sur notre version hébergée, tu paies 1,5 % + 0,25 € par transaction sur les billets payants, plus les frais de Stripe. La partie fixe est prélevée une fois par commande : une personne qui achète quatre billets ne te coûte donc pas quatre fois 0,25 €. Les événements gratuits, les RSVP et les billets payés hors ligne n’ont aucuns frais de plateforme. Compare avec ce qu’Eventbrite facture dans ton pays, et garde en tête qu’en auto-hébergeant Revel, nos frais disparaissent complètement.'
		},
		{
			question: 'Puis-je transférer mes événements depuis Eventbrite ?',
			answer:
				'Oui. Connecte ton compte Eventbrite dans l’espace d’administration de ton organisation et choisis les événements à venir que tu veux récupérer. Chacun arrive en brouillon, avec sa description, ses dates, son lieu et ses catégories de billets. Les catégories payantes restent en pause tant que ton compte Stripe n’est pas connecté, pour que rien ne soit mis en vente par erreur. Les participant·es et les commandes passées restent sur Eventbrite, car Revel ne les importe pas.'
		},
		{
			question: 'Puis-je continuer à vendre sur Eventbrite pendant la transition ?',
			answer:
				'Oui. Tu peux envoyer un événement Revel et ses catégories de billets vers Eventbrite, l’y publier et mettre en pause certaines catégories quand tu veux. Les billets vendus sur Eventbrite reviennent comme ventes externes dans la catégorie correspondante, pour que tu aies une vue d’ensemble au même endroit.'
		},
		{
			question: 'Faut-il un compte pour participer ?',
			answer:
				'Pas si tu ne le souhaites pas. Active l’achat sans compte pour un événement et les gens peuvent obtenir leurs billets avec une simple adresse e-mail.'
		},
		{
			question: 'L’auto-hébergement de Revel est-il vraiment gratuit ?',
			answer:
				'Oui. Revel est sous licence MIT, tu peux donc le faire tourner sur ton propre serveur sans rien nous payer. Tu prends en charge ton hébergement et, si tu vends des billets en ligne, les frais de Stripe. Un petit serveur avec 2 vCPU et 4 Go de RAM suffit pour démarrer.'
		},
		{
			question: 'Où tourne la version hébergée ?',
			answer:
				'Sur des serveurs en Europe. En auto-hébergement, c’est toi qui décides où se trouvent tes données.'
		}
	],
	relatedPages: [
		'self-hosted-event-platform',
		'privacy-focused-events',
		'club-membership-management'
	]
};
