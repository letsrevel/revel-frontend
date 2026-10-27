import type { EventInListSchema } from '$lib/api/generated/types.gen';

export const UPCOMING_LIMIT = 6;

export interface DashboardModel {
	/** Events that have not ended yet (running or future), templates excluded, by start. */
	live: EventInListSchema[];
	/** First live event that is not cancelled (drafts allowed). */
	nextEvent: EventInListSchema | null;
	isHappeningNow: boolean;
	/** Live events after `nextEvent`, capped. Cancelled ones stay (they show a badge). */
	upcoming: EventInListSchema[];
}

export function buildDashboardModel(events: EventInListSchema[], now: Date): DashboardModel {
	const live = events
		.filter((e) => !e.is_template && new Date(e.end) > now)
		.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
	const nextEvent = live.find((e) => e.status !== 'cancelled') ?? null;
	const isHappeningNow =
		nextEvent !== null && new Date(nextEvent.start) <= now && now < new Date(nextEvent.end);
	const upcoming = live.filter((e) => e !== nextEvent).slice(0, UPCOMING_LIMIT);
	return { live, nextEvent, isHappeningNow, upcoming };
}
