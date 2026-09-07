import type {
	EventDetailSchema,
	EventLinkSchema,
	EventListingSchema,
	SyncReportEntry,
	TicketTierDetailSchema
} from '$lib/api/generated/types.gen';
import type { Tone } from '$lib/components/common/tones';

export type ListingViewKind =
	| 'not-connected'
	| 'access-lost'
	| 'unlisted'
	| 'pending'
	| 'draft'
	| 'live'
	| 'cancelled'
	| 'failed'
	| 'broken';

export interface ListingView {
	kind: ListingViewKind;
	/** Card tint + icon chip tone. Body text never carries it. */
	tone: Tone;
	/** Create the draft, update the listing, retry, or recreate a removed one. */
	canPush: boolean;
	/** Only a remote draft can be published from Revel. */
	canPublish: boolean;
	/** A remote URL exists and the listing is still there. */
	canView: boolean;
	/** The per-event auto-sync override makes sense only for a live-able link. */
	canSetAutoSync: boolean;
}

/**
 * One card state per `EventListingSchema`. The organization's connection
 * decides first (staff cannot read the owner-only connection list, so the row
 * carries it); then the link's sync state; then its remote status.
 */
export function listingView(listing: EventListingSchema): ListingView {
	const status = listing.connection_status ?? null;
	if (status === null || status === 'pending') {
		return {
			kind: 'not-connected',
			tone: 'neutral',
			canPush: false,
			canPublish: false,
			canView: false,
			canSetAutoSync: false
		};
	}
	if (status === 'error' || status === 'revoked') {
		return {
			kind: 'access-lost',
			tone: 'danger',
			canPush: false,
			canPublish: false,
			canView: false,
			canSetAutoSync: false
		};
	}
	const link = listing.link ?? null;
	if (link === null) {
		return {
			kind: 'unlisted',
			tone: 'neutral',
			canPush: true,
			canPublish: false,
			canView: false,
			canSetAutoSync: false
		};
	}
	const canView = link.remote_url !== '' && link.sync_state !== 'broken';
	if (link.sync_state === 'pending') {
		return {
			kind: 'pending',
			tone: 'info',
			canPush: false,
			canPublish: false,
			canView,
			canSetAutoSync: true
		};
	}
	if (link.sync_state === 'broken') {
		return {
			kind: 'broken',
			tone: 'warning',
			canPush: true,
			canPublish: false,
			canView: false,
			canSetAutoSync: false
		};
	}
	if (link.sync_state === 'failed') {
		return {
			kind: 'failed',
			tone: 'danger',
			canPush: true,
			canPublish: false,
			canView,
			canSetAutoSync: true
		};
	}
	switch (link.remote_status) {
		case 'live':
			return {
				kind: 'live',
				tone: 'success',
				canPush: true,
				canPublish: false,
				canView,
				canSetAutoSync: true
			};
		case 'cancelled':
			return {
				kind: 'cancelled',
				tone: 'neutral',
				canPush: false,
				canPublish: false,
				canView,
				canSetAutoSync: false
			};
		default:
			return {
				kind: 'draft',
				tone: 'info',
				canPush: true,
				canPublish: true,
				canView,
				canSetAutoSync: true
			};
	}
}

export type PushBlocker = 'event_private' | 'event_open_ended' | 'event_no_tickets';

/**
 * The three eligibility rules the backend enforces on push (`mapper.py`),
 * evaluated up front on the saved event so the button explains itself instead
 * of failing with a 400.
 */
export function pushBlockers(
	event: Pick<EventDetailSchema, 'event_type' | 'is_open_ended' | 'requires_ticket'>
): PushBlocker[] {
	const blockers: PushBlocker[] = [];
	if (event.event_type !== 'public') blockers.push('event_private');
	// `end` is always set (the backend fills an operational horizon even for
	// open-ended events); `is_open_ended` is the flag the mapper checks.
	if (event.is_open_ended) blockers.push('event_open_ended');
	if (!event.requires_ticket) blockers.push('event_no_tickets');
	return blockers;
}

export interface GroupedReport {
	/** Event-scope failures: the push did not, or only partly, go through. */
	problems: SyncReportEntry[];
	/** Tiers the mapper left out, each with its rule. */
	skipped: SyncReportEntry[];
	/** Advisory: missing cover image, classes created on the platform. */
	notes: SyncReportEntry[];
}

const NOTE_CODES = new Set<SyncReportEntry['code']>(['image_missing', 'remote_only_tier']);

export function groupReport(entries: SyncReportEntry[]): GroupedReport {
	const grouped: GroupedReport = { problems: [], skipped: [], notes: [] };
	for (const entry of entries) {
		if (NOTE_CODES.has(entry.code)) grouped.notes.push(entry);
		else if (entry.scope === 'tier' && entry.code.startsWith('tier_')) grouped.skipped.push(entry);
		else grouped.problems.push(entry);
	}
	return grouped;
}

export type AutoSyncChoice = 'inherit' | 'on' | 'off';

export function autoSyncChoice(link: Pick<EventLinkSchema, 'auto_sync'>): AutoSyncChoice {
	if (link.auto_sync === null || link.auto_sync === undefined) return 'inherit';
	return link.auto_sync ? 'on' : 'off';
}

/** `null` clears the override so the connection default applies again. */
export function autoSyncPayload(choice: AutoSyncChoice): boolean | null {
	if (choice === 'inherit') return null;
	return choice === 'on';
}

/**
 * Tickets sold on Revel and on one platform, summed over the event's tiers.
 * The platform figure comes from `external_sales`, which webhooks and the
 * 15-minute reconcile keep current out of band.
 */
export function soldTotals(
	tiers: Pick<TicketTierDetailSchema, 'quantity_sold' | 'external_sales'>[],
	provider: string
): { revel: number; external: number } {
	let revel = 0;
	let external = 0;
	for (const tier of tiers) {
		revel += tier.quantity_sold ?? 0;
		for (const sale of tier.external_sales ?? []) {
			if (sale.provider === provider) external += sale.quantity_sold;
		}
	}
	return { revel, external };
}

/** After this long in `pending`, the card says so and polling slows down. */
export const PENDING_SLOW_AFTER_MS = 10 * 60_000;
const PENDING_FAST_INTERVAL_MS = 3_000;
const PENDING_SLOW_INTERVAL_MS = 30_000;
/** Idle cadence: sold counts change out of band, so keep them fresh while the tab is open. */
const IDLE_INTERVAL_MS = 60_000;
/** The event's own tiers refresh on the same cadence; the sold summary reads both. */
export const TIERS_REFRESH_MS = IDLE_INTERVAL_MS;

export function hasPendingLink(listings: EventListingSchema[] | undefined): boolean {
	return (listings ?? []).some((l) => l.link?.sync_state === 'pending');
}

/**
 * Fast while a push is in flight, slow once the tab is idle. A link can stay
 * `pending` for many minutes under retries (and, in three backend edge cases,
 * forever), so the cadence drops after ten minutes rather than stopping:
 * silence would read as a hang. Idle polling keeps the sold counts current;
 * `refetchIntervalInBackground: false` at the call site stops it in a hidden tab.
 */
export function listingsRefetchInterval(
	listings: EventListingSchema[] | undefined,
	pendingSince: number | null,
	now: number
): number | false {
	if (listings === undefined) return false;
	if (!hasPendingLink(listings)) return IDLE_INTERVAL_MS;
	if (pendingSince !== null && now - pendingSince >= PENDING_SLOW_AFTER_MS) {
		return PENDING_SLOW_INTERVAL_MS;
	}
	return PENDING_FAST_INTERVAL_MS;
}
