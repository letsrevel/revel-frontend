// Bounded "poll until a condition holds" primitive for TanStack Query.
//
// Some backend workflows are asynchronous on the server side: the client kicks
// something off (a Stripe Checkout return, a webhook-driven state change) and
// then has to watch a resource until it settles. Polling forever is a bug —
// a wedged webhook would leave a tab hammering the API indefinitely — so every
// such loop needs both a stop condition and a wall-clock deadline.
//
// `PollUntil` packages that pair. It owns no timers and imports nothing: it
// just produces the options object TanStack Query needs, plus a pure `phase()`
// projection the UI can render from.
//
// Consumer shape (@tanstack/svelte-query v6, function-form `createQuery`):
//
// ```ts
// let timedOut = $state(false);
// const poll = new PollUntil({
// 	queryKey: [...],
// 	queryFn,
// 	isDone: (s) => s.status === 'active',
// 	onTimeout: () => (timedOut = true)
// });
// const q = createQuery(() => poll.options());
// const phase = $derived.by(() => {
// 	void timedOut; // re-run when the deadline lapses, not just when data changes
// 	return poll.phase(q.data);
// });
// ```
//
// That `void timedOut` is load-bearing, not ceremony. `phase()` reads the wall
// clock, but a plain `$derived(poll.phase(q.data))` depends only on `q.data` —
// and a still-pending resource polled every 3s returns structurally identical
// data, which svelte-query's default structural sharing collapses to the same
// reference. So `q.data` never changes identity, the derived never re-runs, and
// the UI sits on `polling` forever even though polling has actually stopped.
// The `onTimeout` signal is the time-varying reactive dependency that fixes it.
//
// Caveat: with `refetchIntervalInBackground: false`, a backgrounded tab stops
// evaluating the interval, so a deadline that lapses while the tab is hidden is
// only detected — and `onTimeout` only fired — once the tab is refocused.
//
// Hold the instance across renders (module/component scope, not inside a
// `$derived`): the deadline is measured from construction, so re-constructing
// it on every render would reset the clock and defeat the timeout. Because
// `createQuery` takes a factory, `options()` is re-read reactively — the
// `enabled` closure is evaluated on each call, so it can depend on runes.

/**
 * Where a bounded poll currently stands.
 *
 * - `polling` — still waiting, still within the deadline.
 * - `done` — the data satisfied `isDone`.
 * - `timed_out` — the deadline elapsed before the data ever satisfied `isDone`.
 */
export type PollPhase = 'polling' | 'done' | 'timed_out';

export interface PollUntilConfig<TData> {
	/** Query key for the polled resource. */
	queryKey: readonly unknown[];
	/** Fetcher for the polled resource. */
	queryFn: () => Promise<TData>;
	/** Stop condition — once this is true for the latest data, polling stops. */
	isDone: (data: TData) => boolean;
	/** Reactive gate, re-evaluated on every `options()` call. Default: always on. */
	enabled?: () => boolean;
	/** Delay between polls while pending. Default: 3000ms. */
	intervalMs?: number;
	/** Wall-clock deadline measured from construction / `reset()`. Default: 120000ms. */
	timeoutMs?: number;
	/**
	 * Fired at most once, the first time the deadline is observed to have
	 * lapsed with the poll still unfinished. Exists so the UI has a reactive
	 * signal to depend on — see the note on `phase()`. Re-armed by `reset()`.
	 */
	onTimeout?: () => void;
}

const DEFAULT_INTERVAL_MS = 3_000;
const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * The minimal shape of the `Query` object TanStack passes to `refetchInterval`.
 * Structural, so this module stays dependency-free; it is assignable from the
 * real `Query` generic at the call site.
 */
interface RefetchIntervalQuery<TData> {
	state: { data?: TData };
}

export class PollUntil<TData> {
	readonly #cfg: PollUntilConfig<TData>;
	#startedAt: number;
	#timeoutNotified = false;

	constructor(config: PollUntilConfig<TData>) {
		this.#cfg = config;
		this.#startedAt = Date.now();
	}

	/** Restart the deadline — e.g. when the user retries a settled-but-timed-out poll. */
	reset(): void {
		this.#startedAt = Date.now();
		this.#timeoutNotified = false;
	}

	#expired(): boolean {
		return Date.now() - this.#startedAt >= (this.#cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS);
	}

	/** Options object for `createQuery(() => poll.options())`. */
	options() {
		return {
			queryKey: this.#cfg.queryKey,
			queryFn: this.#cfg.queryFn,
			enabled: this.#cfg.enabled?.() ?? true,
			refetchInterval: (query: RefetchIntervalQuery<TData>): number | false => {
				const data = query.state.data;
				if (data !== undefined && this.#cfg.isDone(data)) return false;
				if (this.#expired()) {
					// The one place expiry is observed while the poll is live: the
					// interval schedule guarantees at least one post-deadline
					// evaluation. Emit the signal here so the UI can react to a
					// deadline that no data change would otherwise surface.
					if (!this.#timeoutNotified) {
						this.#timeoutNotified = true;
						this.#cfg.onTimeout?.();
					}
					return false;
				}
				return this.#cfg.intervalMs ?? DEFAULT_INTERVAL_MS;
			},
			// A backgrounded tab has nothing to render; resume when it is focused again.
			refetchIntervalInBackground: false,
			// The poll itself is the retry loop — a failed tick just tries again next interval.
			retry: false,
			// Every tick must hit the network; a cached answer would never settle.
			staleTime: 0
		};
	}

	/**
	 * Pure projection of the current phase, given the latest data and the
	 * internal clock. `done` wins over `timed_out`: data that satisfied
	 * `isDone` is a success even if it arrived past the deadline.
	 *
	 * Time-dependent, so a `$derived` wrapping this needs a reactive dependency
	 * that changes when the deadline lapses — use `onTimeout`, per the consumer
	 * pattern at the top of this module.
	 */
	phase(data: TData | undefined): PollPhase {
		if (data !== undefined && this.#cfg.isDone(data)) return 'done';
		if (this.#expired()) return 'timed_out';
		return 'polling';
	}
}
