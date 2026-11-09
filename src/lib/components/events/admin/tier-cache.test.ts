import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import type { TicketTierDetailSchema } from '$lib/api/generated/types.gen';
import { removeTierFromCache, tierListKey, upsertTierInCache } from './tier-cache';

const tier = (id: string, name = id): TicketTierDetailSchema =>
	({ id, name }) as TicketTierDetailSchema;

function seeded(results: TicketTierDetailSchema[], count?: number) {
	const client = new QueryClient();
	client.setQueryData(tierListKey('e1'), { data: { results, count }, response: { status: 200 } });
	return client;
}
const read = (c: QueryClient) =>
	c.getQueryData<{ data: { results: TicketTierDetailSchema[]; count?: number } }>(
		tierListKey('e1')
	);

describe('tier-cache', () => {
	it('replaces a tier by id and keeps the rest of the entry', () => {
		const c = seeded([tier('a'), tier('b')], 2);
		upsertTierInCache(c, 'e1', tier('b', 'renamed'));
		expect(read(c)?.data.results.map((t) => t.name)).toEqual(['a', 'renamed']);
		expect(read(c)?.data.count).toBe(2);
	});

	it('appends a new tier and bumps the count', () => {
		const c = seeded([tier('a')], 1);
		upsertTierInCache(c, 'e1', tier('z'));
		expect(read(c)?.data.results.map((t) => t.id)).toEqual(['a', 'z']);
		expect(read(c)?.data.count).toBe(2);
	});

	it('removes a tier and drops the count', () => {
		const c = seeded([tier('a'), tier('b')], 2);
		removeTierFromCache(c, 'e1', 'a');
		expect(read(c)?.data.results.map((t) => t.id)).toEqual(['b']);
		expect(read(c)?.data.count).toBe(1);
	});

	it('does nothing when there is no cache entry', () => {
		const c = new QueryClient();
		upsertTierInCache(c, 'e1', tier('a'));
		removeTierFromCache(c, 'e1', 'a');
		expect(c.getQueryData(tierListKey('e1'))).toBeUndefined();
	});
});
