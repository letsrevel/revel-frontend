import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn(), success: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast }));

import FilterNavigatorHarness from './FilterNavigatorHarness.svelte';

interface Call {
	qs: string;
	replace: boolean;
	resolve: () => void;
	reject: (e: Error) => void;
}

/** A goto whose navigations stay in flight until the test settles them. */
function slowGoto() {
	const calls: Call[] = [];
	const goto = vi.fn(
		(qs: string, opts: { replace: boolean }) =>
			new Promise<void>((resolve, reject) => {
				calls.push({ qs, replace: opts.replace, resolve, reject });
			})
	);
	return { calls, goto };
}

const TIER_ID = '0b8b3a52-7a54-4f6b-9a1e-6c5d1f7a3c11';

function setup() {
	const g = slowGoto();
	render(FilterNavigatorHarness, { props: { goto: g.goto } });
	const tier = screen.getByLabelText(/^tier/i) as HTMLSelectElement;
	const chip = (name: string) => screen.getByRole('button', { name });
	return { ...g, tier, chip };
}

const pressed = (el: HTMLElement) => el.getAttribute('aria-pressed') === 'true';

beforeEach(() => toast.error.mockClear());
afterEach(() => vi.useRealTimers());

describe('filter navigator race (rendered intermediate states)', () => {
	it('keeps the chip and tier on the intended values mid-flight and coalesces into one more goto', async () => {
		const { calls, goto, tier, chip } = setup();
		expect(pressed(chip('Current'))).toBe(true);
		await userEvent.click(chip('Ended'));
		await userEvent.selectOptions(tier, TIER_ID);
		// (a) first goto still in flight: nothing reverted, only one goto so far
		expect(goto).toHaveBeenCalledTimes(1);
		expect(pressed(chip('Ended'))).toBe(true);
		expect(pressed(chip('Current'))).toBe(false);
		expect(tier.value).toBe(TIER_ID);
		calls[0].resolve();
		// (b) exactly one more goto, carrying both filters
		await waitFor(() => expect(goto).toHaveBeenCalledTimes(2));
		expect(calls[1].qs).toBe(`tab=people&view=ended&tier=${TIER_ID}`);
		expect(calls[1].replace).toBe(true);
		expect(pressed(chip('Ended'))).toBe(true);
		expect(tier.value).toBe(TIER_ID);
		calls[1].resolve();
		await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('view=ended'));
		expect(goto).toHaveBeenCalledTimes(2);
		expect(pressed(chip('Ended'))).toBe(true);
		expect(tier.value).toBe(TIER_ID);
	});

	it('does not wipe search text typed mid-flight and applies it after the debounce', async () => {
		const { calls, goto, chip } = setup();
		await userEvent.click(chip('Ended'));
		const search = screen.getByLabelText(/search/i);
		await userEvent.type(search, 'ada');
		calls[0].resolve(); // intermediate settle while the debounce may still be pending
		await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('view=ended'));
		expect(search).toHaveValue('ada');
		await waitFor(() => expect(goto.mock.calls.length).toBeGreaterThanOrEqual(2));
		const last = calls[calls.length - 1];
		expect(last.qs).toBe('tab=people&view=ended&q=ada');
		last.resolve();
		await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('q=ada'));
		expect(search).toHaveValue('ada');
	});

	it('keeps the pending chip when Next page is clicked mid-flight', async () => {
		const { calls, goto, chip } = setup();
		await userEvent.click(chip('Everyone'));
		await userEvent.click(screen.getByRole('button', { name: 'Next' }));
		expect(goto).toHaveBeenCalledTimes(1);
		calls[0].resolve();
		await waitFor(() => expect(goto).toHaveBeenCalledTimes(2));
		expect(calls[1].qs).toBe('tab=people&view=everyone&page=2');
		// pagination is the one navigation allowed to push history
		expect(calls[1].replace).toBe(false);
		expect(pressed(chip('Everyone'))).toBe(true);
	});

	it('shows a toast and falls back to the URL state when a navigation rejects', async () => {
		const { calls, chip } = setup();
		await userEvent.click(chip('Ended'));
		calls[0].reject(new Error('nav failed'));
		await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
		expect(toast.error).toHaveBeenCalledWith("Couldn't apply the filters. Try again.");
		await waitFor(() => expect(pressed(chip('Current'))).toBe(true));
	});
});
