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
import type { Tone } from '$lib/components/common/tones';

export type StatusTone = 'green' | 'blue' | 'amber' | 'gray' | 'red' | 'muted';

export interface StatusConfig {
	tone: StatusTone;
}

// `tone` here is the pre-rebrand descriptive axis (kept: `subscriptions.test.ts`
// pins these six values and nothing about them changed). `className` is GONE —
// it was the last raw `bg-green-100`/`bg-gray-200` map in this codebase (the
// rebrand's raw-hue sweep target). Every renderer now goes through
// `getStatusTone` below, which maps onto the shared `common/StatusBadge` token
// vocabulary instead.
const STATUS_CONFIG: Record<SubscriptionStatus, StatusConfig> = {
	active: { tone: 'green' },
	pending: { tone: 'blue' },
	past_due: { tone: 'amber' },
	paused: { tone: 'gray' },
	cancelled: { tone: 'muted' },
	expired: { tone: 'red' }
};

export function getStatusConfig(status: SubscriptionStatus): StatusConfig {
	return STATUS_CONFIG[status];
}

/**
 * Semantic `Tone` (rebrand vocabulary) for one `SubscriptionStatus`. The
 * single source both `members/SubscriptionStatusBadge` (single-status pill, `aria-label`
 * carries the name) and `members/SubscriptionMetrics` (label+count chip strip,
 * deliberately unlabelled — see `StatusBadge.test.ts`) render from, so the two
 * surfaces can't drift onto different tones for the same status again.
 *
 * `paused` does not share `active`'s `success` — it needs attention, so it
 * takes `warning` — and it stays visually louder than the two terminal states.
 * `past_due` is a harder problem than "pending payment" (it risks losing
 * access), so it escalates to `danger`. `cancelled` and `expired` collapse
 * onto the same `neutral` tone deliberately: both are terminal/over, and the
 * label text ("Cancelled" vs "Expired") — not the tone — carries the
 * distinction.
 */
const TONE_MAP: Record<SubscriptionStatus, Tone> = {
	active: 'success',
	pending: 'info',
	past_due: 'danger',
	paused: 'warning',
	cancelled: 'neutral',
	expired: 'neutral'
};

export function getStatusTone(status: SubscriptionStatus): Tone {
	return TONE_MAP[status];
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
