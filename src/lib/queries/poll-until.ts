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
// const poll = new PollUntil({
// 	queryKey: [...],
// 	queryFn,
// 	isDone: (s) => s.status === 'active'
// });
// const q = createQuery(() => poll.options());
// const phase = $derived(poll.phase(q.data));
// ```
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

	constructor(config: PollUntilConfig<TData>) {
		this.#cfg = config;
		this.#startedAt = Date.now();
	}

	/** Restart the deadline — e.g. when the user retries a settled-but-timed-out poll. */
	reset(): void {
		this.#startedAt = Date.now();
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
				if (this.#expired()) return false;
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
	 */
	phase(data: TData | undefined): PollPhase {
		if (data !== undefined && this.#cfg.isDone(data)) return 'done';
		if (this.#expired()) return 'timed_out';
		return 'polling';
	}
}
