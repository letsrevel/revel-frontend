/**
 * EU country compliance (#1001): helpers shared by the org "Country rules" card,
 * the invoicing-mode gates, the tier editor and checkout.
 *
 * The backend decides everything (`OrganizationComplianceSchema` /
 * `EventComplianceSchema`); this module only turns those decisions into copy.
 * Never branch on a notice's `message` — key on `key` / `applies_to`.
 */
import * as m from '$lib/paraglide/messages.js';
import { getLocale } from '$lib/paraglide/runtime.js';
import type {
	ComplianceNoticeSchema,
	EventComplianceSchema,
	NoticeTopic,
	OrganizationComplianceSchema
} from '$lib/api/generated/types.gen';

/** Load state of an event's `compliance`; anything but `ready` fails closed. */
export type ComplianceStatus = 'loading' | 'error' | 'ready';

/** An event's rules as the tier editor consumes them: data, load state, retry. */
export interface EventRules {
	compliance: EventComplianceSchema | null;
	status: ComplianceStatus;
	onRetry?: () => void;
}

/** EU member states: the only countries Revel checks rules for. */
export const EU_COUNTRY_CODES: ReadonlySet<string> = new Set([
	'AT',
	'BE',
	'BG',
	'CY',
	'CZ',
	'DE',
	'DK',
	'EE',
	'ES',
	'FI',
	'FR',
	'GR',
	'HR',
	'HU',
	'IE',
	'IT',
	'LT',
	'LU',
	'LV',
	'MT',
	'NL',
	'PL',
	'PT',
	'RO',
	'SE',
	'SI',
	'SK'
]);

const DOCS_BASE = 'https://docs.letsrevel.io/compliance';

/**
 * Localized country name for an ISO 3166-1 alpha-2 code, in the active UI
 * language. The backend uses `GR` for Greece (VAT prefix `EL` is normalized
 * server-side). Falls back to the code itself if the runtime can't resolve it.
 */
export function countryName(code: string): string {
	if (!code) return '';
	try {
		// The `pt` catalog is European Portuguese; bare `pt` resolves to Brazilian
		// names in Intl ("Romênia", "Polônia"), so ask for pt-PT explicitly.
		const locale = getLocale() === 'pt' ? 'pt-PT' : getLocale();
		const names = new Intl.DisplayNames([locale], { type: 'region' });
		return names.of(code.toUpperCase()) ?? code;
	} catch {
		return code;
	}
}

export function isEuCountry(code: string): boolean {
	return EU_COUNTRY_CODES.has(code.toUpperCase());
}

/**
 * Subdivisions with their own invoicing rules (#1010), keyed by the API's
 * ISO 3166-2 `region`: the Basque Country (TicketBAI, blocked now) and Navarre
 * (NaTicket, outside Verifactu). The anchor points at their section of the
 * country page.
 */
const REGION_DOCS_ANCHOR: Record<string, string> = {
	'ES-PV': '#basque-country-ticketbai',
	'ES-NC': '#navarre'
};

/** The per-country docs page, or the section index when the country is unknown / non-EU. */
export function complianceDocsUrl(code: string, region = ''): string {
	const anchor = REGION_DOCS_ANCHOR[region.toUpperCase()] ?? '';
	if (code && isEuCountry(code)) return `${DOCS_BASE}/eu/${code.toLowerCase()}/${anchor}`;
	if (code) return `${DOCS_BASE}/`;
	return `${DOCS_BASE}/eu/`;
}

/** The e-invoicing system named in the per-country invoicing notices. */
export function invoicingSystemName(code: string): string {
	switch (code.toUpperCase()) {
		case 'HR':
			return m['compliance.system.hr']();
		case 'SI':
			return m['compliance.system.si']();
		case 'GR':
			return m['compliance.system.gr']();
		case 'PT':
			return m['compliance.system.pt']();
		case 'HU':
			return m['compliance.system.hu']();
		case 'RO':
			return m['compliance.system.ro']();
		case 'ES':
			return m['compliance.system.es']();
		default:
			return m['compliance.system.generic']();
	}
}

/**
 * The e-invoicing network named in the business-buyer notice. Kept apart from
 * `invoicingSystemName`, whose PT values carry the preposition the blocked
 * template needs ("pelo …"); here the template supplies its own.
 */
export function businessInvoicingSystemName(code: string): string {
	switch (code.toUpperCase()) {
		case 'BE':
			return 'Peppol';
		case 'PL':
			return 'KSeF';
		default:
			return m['compliance.system.businessGeneric']();
	}
}

/** API keys of Spain's pre-2027 heads-up notice (#1087), Navarre's included (#1010). */
const UPCOMING_BLOCK_NOTICE_KEYS: ReadonlySet<string> = new Set(['es_verifactu', 'es_nc_naticket']);

/**
 * Spain's invoicing block starts on 1 January 2027. The API reads `allowed`
 * until then and doesn't expose the date, so the warning is keyed on the
 * country while the capability is still `allowed`. The Basque Country is
 * blocked already, so it never reads `allowed` here.
 */
export function hasUpcomingInvoicingBlock(compliance: OrganizationComplianceSchema): boolean {
	return compliance.country === 'ES' && compliance.attendee_invoicing === 'allowed';
}

/**
 * Tone of an API notice: the upcoming-block heads-ups announce a restriction,
 * so they keep the warning tone the client banner had; every other notice is
 * information. Keyed on `key`, never on the text.
 */
export function noticeTone(notice: ComplianceNoticeSchema): 'info' | 'warning' {
	return UPCOMING_BLOCK_NOTICE_KEYS.has(notice.key) ? 'warning' : 'info';
}

/**
 * Whether the API sends the heads-up itself as an `attendee_invoicing` notice
 * (rendered next to the mode selector). Then the client copy, which names
 * Verifactu, must not repeat it, and for Navarre it would be wrong.
 */
function apiSendsUpcomingNotice(compliance: OrganizationComplianceSchema): boolean {
	return (compliance.notices ?? []).some((n) => UPCOMING_BLOCK_NOTICE_KEYS.has(n.key));
}

/** Region-specific blocked copy (#1010), else null for the country template. */
function regionBlockedText(region: string): string | null {
	switch (region.toUpperCase()) {
		case 'ES-PV':
			return m['compliance.invoicing.blockedEsPv']();
		case 'ES-NC':
			return m['compliance.invoicing.blockedEsNc']();
		default:
			return null;
	}
}

function regionBlockedBullet(region: string): string | null {
	switch (region.toUpperCase()) {
		case 'ES-PV':
			return m['compliance.bullet.invoicingBlockedEsPv']();
		case 'ES-NC':
			return m['compliance.bullet.invoicingBlockedEsNc']();
		default:
			return null;
	}
}

/** Copy for the invoicing-mode section, or null when invoicing works normally. */
export function invoicingNotice(
	compliance: OrganizationComplianceSchema
): { kind: 'blocked' | 'upcoming' | 'business'; text: string } | null {
	const country = countryName(compliance.country);
	const system = invoicingSystemName(compliance.country);
	if (compliance.attendee_invoicing === 'blocked') {
		const text =
			regionBlockedText(compliance.region ?? '') ??
			m['compliance.invoicing.blocked']({ country, system });
		return { kind: 'blocked', text };
	}
	if (compliance.attendee_invoicing === 'blocked_for_business_buyers') {
		const text =
			compliance.country === 'PL'
				? m['compliance.invoicing.businessBuyersAll']()
				: m['compliance.invoicing.businessBuyers']({
						country,
						system: businessInvoicingSystemName(compliance.country)
					});
		return { kind: 'business', text };
	}
	// Only when the API doesn't send its own notice (an older backend), and
	// never for Navarre: this copy names Verifactu, which doesn't apply there.
	if (
		hasUpcomingInvoicingBlock(compliance) &&
		!apiSendsUpcomingNotice(compliance) &&
		(compliance.region ?? '') === ''
	) {
		return { kind: 'upcoming', text: m['compliance.invoicing.upcomingEs']() };
	}
	return null;
}

/** One bullet per restriction, for the org "Country rules" card. */
export function restrictionBullets(compliance: OrganizationComplianceSchema): string[] {
	const country = countryName(compliance.country);
	const bullets: string[] = [];
	if (compliance.attendee_invoicing === 'blocked') {
		bullets.push(
			regionBlockedBullet(compliance.region ?? '') ??
				m['compliance.bullet.invoicingBlocked']({ country })
		);
	} else if (compliance.attendee_invoicing === 'blocked_for_business_buyers') {
		bullets.push(
			compliance.country === 'PL'
				? m['compliance.bullet.invoicingBusinessBuyersAll']()
				: m['compliance.bullet.invoicingBusinessBuyers']({ country })
		);
	} else if (hasUpcomingInvoicingBlock(compliance)) {
		bullets.push(m['compliance.bullet.invoicingUpcomingEs']());
	}
	if (compliance.online_payment === 'blocked') {
		bullets.push(m['compliance.bullet.onlinePaymentBlocked']({ country }));
	}
	if (compliance.offline_payment === 'blocked') {
		bullets.push(m['compliance.bullet.offlinePaymentBlocked']({ country }));
	}
	return bullets;
}

/** Notices whose `applies_to` is one of `topics`, in API order. */
export function noticesFor(
	notices: readonly ComplianceNoticeSchema[] | undefined,
	...topics: NoticeTopic[]
): ComplianceNoticeSchema[] {
	return (notices ?? []).filter((notice) => topics.includes(notice.applies_to));
}

/** The online-payment notice for the tier editor; Italy has its own wording. */
export function onlinePaymentBlockedText(venueCountry: string): string {
	if (venueCountry === 'IT') return m['compliance.tier.onlineBlockedIt']();
	return m['compliance.tier.onlineBlocked']({
		country: countryName(venueCountry) || m['compliance.thisCountry']()
	});
}

/** Whether priced tickets for this event are reservations (Italy, #1069). */
export function isReservationOnly(venueCountry: string | undefined): boolean {
	return venueCountry === 'IT';
}

/** The pricing fields of a public tier that decide whether it charges anything. */
interface PricedTierFields {
	price?: string | number | null;
	price_type?: string;
	seat_pricing?: {
		categories?: Array<{ price?: string | null }>;
		unpainted?: string | null;
	} | null;
}

/**
 * Mirrors the backend's `tier_is_paid`: PWYC, a positive flat price, or any
 * positive category price. A free-priced offline tier (e.g. the auto-created
 * "General Admission" at 0.00) is not a sale and gets no reservation copy.
 */
export function tierIsPriced(tier: PricedTierFields): boolean {
	if (tier.price_type === 'pwyc') return true;
	if (Number(tier.price ?? 0) > 0) return true;
	const categoryPrices = [
		...(tier.seat_pricing?.categories ?? []).map((c) => c.price),
		tier.seat_pricing?.unpainted
	];
	return categoryPrices.some((price) => Number(price ?? 0) > 0);
}

/**
 * Tiers a buyer may start a purchase on under the event's country rules: online
 * tiers drop out when `online_payment` is blocked (the API would 422). Feeds the
 * map-first entry point (#679), which must offer exactly what the tier cards do
 * — picking a sector there places real seat holds.
 */
export function withoutBlockedOnlineTiers<T extends { payment_method?: string }>(
	tiers: T[],
	compliance: Pick<EventComplianceSchema, 'online_payment'> | null | undefined
): T[] {
	if (compliance?.online_payment !== 'blocked') return tiers;
	return tiers.filter((tier) => tier.payment_method !== 'online');
}

const PLACED_TOPICS: ReadonlySet<string> = new Set<NoticeTopic>([
	'offline_payment',
	'ticket_sales'
]);

/**
 * Notices whose `applies_to` this UI has no dedicated place for (a topic the
 * backend added later). The contract says never to drop one: callers show them
 * as general notices.
 */
export function unplacedNotices(
	notices: readonly ComplianceNoticeSchema[] | undefined
): ComplianceNoticeSchema[] {
	return (notices ?? []).filter((notice) => !PLACED_TOPICS.has(notice.applies_to));
}
