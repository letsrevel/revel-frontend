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

	describe('onTimeout signal', () => {
		it('fires exactly once when expiry is first detected', () => {
			const onTimeout = vi.fn();
			const p = new PollUntil({ ...cfg(), timeoutMs: 10_000, onTimeout });
			const { refetchInterval } = p.options();

			// Still inside the deadline — no signal.
			refetchInterval(fakeQuery({ status: 'pending' }));
			expect(onTimeout).not.toHaveBeenCalled();

			vi.setSystemTime(10_001);
			expect(refetchInterval(fakeQuery({ status: 'pending' }))).toBe(false);
			expect(onTimeout).toHaveBeenCalledTimes(1);

			// Any further evaluation must not re-fire.
			refetchInterval(fakeQuery({ status: 'pending' }));
			p.options().refetchInterval(fakeQuery({ status: 'pending' }));
			expect(onTimeout).toHaveBeenCalledTimes(1);
		});

		it('does not fire when the poll finished before the deadline lapsed', () => {
			const onTimeout = vi.fn();
			const p = new PollUntil({ ...cfg(), timeoutMs: 10_000, onTimeout });
			vi.setSystemTime(10_001);
			// Done wins: expiry is never reached in the callback.
			expect(p.options().refetchInterval(fakeQuery({ status: 'active' }))).toBe(false);
			expect(onTimeout).not.toHaveBeenCalled();
		});

		it('is re-armed by reset()', () => {
			const onTimeout = vi.fn();
			const p = new PollUntil({ ...cfg(), timeoutMs: 10_000, onTimeout });
			vi.setSystemTime(10_001);
			p.options().refetchInterval(fakeQuery({ status: 'pending' }));
			expect(onTimeout).toHaveBeenCalledTimes(1);

			p.reset();
			expect(p.options().refetchInterval(fakeQuery({ status: 'pending' }))).toBe(3000);
			expect(onTimeout).toHaveBeenCalledTimes(1);

			vi.setSystemTime(20_002);
			expect(p.options().refetchInterval(fakeQuery({ status: 'pending' }))).toBe(false);
			expect(onTimeout).toHaveBeenCalledTimes(2);
		});
	});

	describe('options() contract', () => {
		it('carries the documented query settings and passes config through', () => {
			const c = cfg();
			const p = new PollUntil(c);
			expect(p.options()).toMatchObject({
				queryKey: c.queryKey,
				queryFn: c.queryFn,
				enabled: true,
				refetchIntervalInBackground: false,
				retry: false,
				staleTime: 0
			});
			// Pass-through, not a copy: consumers depend on key identity for invalidation.
			expect(p.options().queryKey).toBe(c.queryKey);
			expect(p.options().queryFn).toBe(c.queryFn);
		});

		it('honors the 120000ms default timeout at the boundary', () => {
			const p = new PollUntil(cfg());
			vi.setSystemTime(119_999);
			expect(p.options().refetchInterval(fakeQuery({ status: 'pending' }))).toBe(3000);
			expect(p.phase({ status: 'pending' })).toBe('polling');

			vi.setSystemTime(120_000);
			expect(p.options().refetchInterval(fakeQuery({ status: 'pending' }))).toBe(false);
			expect(p.phase({ status: 'pending' })).toBe('timed_out');
		});
	});
});
