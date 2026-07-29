/**
 * Presentation of one `SubscriptionStatus`: its tint, its localized name, and
 * the order the six of them are listed in.
 *
 * Split out of `subscriptions.ts` (which is at its 500-line cap) rather than
 * inlined per surface: the badge, the metrics strip and the admin status filter
 * are three views of the same enum, and before #702 each carried its own copy
 * of the label map — so a seventh status could reach two of them and be missed
 * by the third. Everything here is re-exported from `$lib/utils/subscriptions`,
 * which stays the documented import site.
 */
import * as m from '$lib/paraglide/messages.js';
import type { SubscriptionStatus } from '$lib/api/generated/types.gen';

export type StatusTone = 'green' | 'blue' | 'amber' | 'gray' | 'red' | 'muted';

export interface StatusConfig {
	tone: StatusTone;
	className: string;
}

const STATUS_CONFIG: Record<SubscriptionStatus, StatusConfig> = {
	active: {
		tone: 'green',
		className: 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100'
	},
	pending: {
		tone: 'blue',
		className: 'bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100'
	},
	past_due: {
		tone: 'amber',
		className: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100'
	},
	paused: {
		tone: 'gray',
		className: 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
	},
	cancelled: { tone: 'muted', className: 'bg-muted text-muted-foreground' },
	expired: {
		tone: 'red',
		className: 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-100'
	}
};

export function getStatusConfig(status: SubscriptionStatus): StatusConfig {
	return STATUS_CONFIG[status];
}

/**
 * Localized name of a subscription status.
 *
 * One copy, called from the badge, the metrics strip and the admin status
 * filter — the three surfaces that previously each carried their own literal
 * object of the same six messages, where a seventh status could reach two of
 * them and be missed by the third.
 *
 * Thunks, not pre-rendered strings: Paraglide resolves the active language at
 * *call* time, so a module-level map of already-called messages would freeze
 * the language the module happened to be imported under.
 */
const STATUS_LABELS: Record<SubscriptionStatus, () => string> = {
	active: () => m['subscriptions.status.active'](),
	pending: () => m['subscriptions.status.pending'](),
	past_due: () => m['subscriptions.status.past_due'](),
	paused: () => m['subscriptions.status.paused'](),
	cancelled: () => m['subscriptions.status.cancelled'](),
	expired: () => m['subscriptions.status.expired']()
};

export function getStatusLabel(status: SubscriptionStatus): string {
	return STATUS_LABELS[status]();
}

/**
 * Display rank of each status: the order the metrics strip reads in and the
 * order the admin filter lists, so an admin looks for a status in the same
 * place in both.
 *
 * A `Record<SubscriptionStatus, …>` rather than a bare array on purpose: it is
 * the construct that *fails to compile* when the backend enum gains a member.
 * An array typed `readonly SubscriptionStatus[]` would happily stay
 * five-elements-long, and a new status would then be silently absent from the
 * strip and unfilterable in the dropdown, with nothing to notice it.
 */
const STATUS_RANK: Record<SubscriptionStatus, number> = {
	active: 0,
	pending: 1,
	past_due: 2,
	paused: 3,
	cancelled: 4,
	expired: 5
};

/** Every `SubscriptionStatus`, in display order. Exhaustive by construction. */
export const STATUS_ORDER: readonly SubscriptionStatus[] = (
	Object.keys(STATUS_RANK) as SubscriptionStatus[]
).sort((a, b) => STATUS_RANK[a] - STATUS_RANK[b]);
