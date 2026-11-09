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

function setup() {
	const g = slowGoto();
	render(FilterNavigatorHarness, { props: { goto: g.goto } });
	const status = screen.getByLabelText(/status/i) as HTMLSelectElement;
	const kind = screen.getByLabelText(/^(kind|type)/i) as HTMLSelectElement;
	return { ...g, status, kind };
}

beforeEach(() => toast.error.mockClear());
afterEach(() => vi.useRealTimers());

describe('filter navigator race (rendered intermediate states)', () => {
	it('keeps both selects on the intended values mid-flight and coalesces into one more goto', async () => {
		const { calls, goto, status, kind } = setup();
		await userEvent.selectOptions(status, 'open');
		await userEvent.selectOptions(kind, 'temporary');
		// (a) first goto still in flight: nothing reverted, only one goto so far
		expect(goto).toHaveBeenCalledTimes(1);
		expect(status.value).toBe('open');
		expect(kind.value).toBe('temporary');
		calls[0].resolve();
		// (b) exactly one more goto, carrying both filters
		await waitFor(() => expect(goto).toHaveBeenCalledTimes(2));
		expect(calls[1].qs).toBe('kind=temporary&status=open');
		expect(calls[1].replace).toBe(true);
		expect(status.value).toBe('open');
		expect(kind.value).toBe('temporary');
		calls[1].resolve();
		await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('kind=temporary'));
		expect(goto).toHaveBeenCalledTimes(2);
		expect(status.value).toBe('open');
		expect(kind.value).toBe('temporary');
	});

	it('does not wipe search text typed mid-flight and applies it after the debounce', async () => {
		const { calls, goto, status } = setup();
		await userEvent.selectOptions(status, 'open');
		const search = screen.getByLabelText(/search/i);
		await userEvent.type(search, 'ada');
		calls[0].resolve(); // intermediate settle while the debounce may still be pending
		await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('status=open'));
		expect(search).toHaveValue('ada');
		await waitFor(() => expect(goto.mock.calls.length).toBeGreaterThanOrEqual(2));
		const last = calls[calls.length - 1];
		expect(last.qs).toBe('status=open&q=ada');
		last.resolve();
		await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('q=ada'));
		expect(search).toHaveValue('ada');
	});

	it('keeps the pending status filter when Next page is clicked mid-flight', async () => {
		const { calls, goto, status } = setup();
		await userEvent.selectOptions(status, 'open');
		await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
		expect(goto).toHaveBeenCalledTimes(1);
		calls[0].resolve();
		await waitFor(() => expect(goto).toHaveBeenCalledTimes(2));
		expect(calls[1].qs).toBe('status=open&page=2');
		// pagination is the one navigation allowed to push history
		expect(calls[1].replace).toBe(false);
		expect(status.value).toBe('open');
	});

	it('shows a toast and falls back to the URL state when a navigation rejects', async () => {
		const { calls, status } = setup();
		await userEvent.selectOptions(status, 'open');
		calls[0].reject(new Error('nav failed'));
		await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
		expect(toast.error).toHaveBeenCalledWith("Couldn't apply the filters. Try again.");
		await waitFor(() => expect(status.value).toBe('all'));
	});
});
