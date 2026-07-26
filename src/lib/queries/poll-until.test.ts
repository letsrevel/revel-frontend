import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PollUntil } from './poll-until';

type S = { status: string };
const cfg = () => ({
	queryKey: ['t'] as const,
	queryFn: async (): Promise<S> => ({ status: 'pending' }),
	isDone: (s: S) => s.status === 'active'
});
const fakeQuery = (data: S | undefined) => ({ state: { data } }) as never;

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(0);
});
afterEach(() => vi.useRealTimers());

describe('PollUntil', () => {
	it('polls at intervalMs while not done', () => {
		const p = new PollUntil(cfg());
		expect(p.options().refetchInterval(fakeQuery({ status: 'pending' }))).toBe(3000);
		expect(p.phase({ status: 'pending' })).toBe('polling');
	});
	it('stops and reports done when isDone', () => {
		const p = new PollUntil(cfg());
		expect(p.options().refetchInterval(fakeQuery({ status: 'active' }))).toBe(false);
		expect(p.phase({ status: 'active' })).toBe('done');
	});
	it('times out after timeoutMs', () => {
		const p = new PollUntil({ ...cfg(), timeoutMs: 10_000 });
		vi.setSystemTime(10_001);
		expect(p.options().refetchInterval(fakeQuery({ status: 'pending' }))).toBe(false);
		expect(p.phase({ status: 'pending' })).toBe('timed_out');
	});
	it('done wins over timeout', () => {
		const p = new PollUntil({ ...cfg(), timeoutMs: 10_000 });
		vi.setSystemTime(10_001);
		expect(p.phase({ status: 'active' })).toBe('done');
	});
	it('reset() restarts the deadline', () => {
		const p = new PollUntil({ ...cfg(), timeoutMs: 10_000 });
		vi.setSystemTime(10_001);
		expect(p.phase({ status: 'pending' })).toBe('timed_out');
		p.reset();
		expect(p.phase({ status: 'pending' })).toBe('polling');
		expect(p.options().refetchInterval(fakeQuery({ status: 'pending' }))).toBe(3000);
	});
	it('respects enabled closure and custom interval', () => {
		const p = new PollUntil({ ...cfg(), enabled: () => false, intervalMs: 500 });
		expect(p.options().enabled).toBe(false);
		const p2 = new PollUntil({ ...cfg(), intervalMs: 500 });
		expect(p2.options().refetchInterval(fakeQuery(undefined))).toBe(500);
	});
});
