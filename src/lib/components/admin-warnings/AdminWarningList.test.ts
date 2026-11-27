import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminWarningList from './AdminWarningList.svelte';
import type { AdminWarning } from '$lib/utils/admin-warnings/types';
import {
	DISMISSED_STORAGE_KEY,
	resetDismissedForTests
} from '$lib/utils/admin-warnings/dismissed.svelte';

function warning(
	id: string,
	level: AdminWarning['level'],
	extra: Partial<AdminWarning> = {}
): AdminWarning {
	return {
		id,
		level,
		title: () => `Title ${id}`,
		message: () => `Message ${id}.`,
		...extra
	};
}

function announcer(): HTMLElement {
	return screen.getByTestId('admin-warning-list-announcer');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('AdminWarningList', () => {
	beforeEach(() => {
		localStorage.clear();
		resetDismissedForTests();
	});

	it('renders each warning with icon tone, title and message, outside the live region', () => {
		render(AdminWarningList, {
			props: { warnings: [warning('W1', 'warn'), warning('I1', 'info')], entityId: 'ev-1' }
		});
		const list = screen.getByRole('list', { name: 'Setting warnings' });
		const items = within(list).getAllByRole('listitem');
		expect(items).toHaveLength(2);
		expect(items[0].querySelector('[data-tone]')).toHaveAttribute('data-tone', 'warning');
		expect(items[1].querySelector('[data-tone]')).toHaveAttribute('data-tone', 'info');
		expect(within(items[0]).getByText('Title W1')).toBeInTheDocument();
		expect(within(items[0]).getByText('Message W1.')).toBeInTheDocument();
		// The only live region is the sr-only announcer; the callouts are not in it.
		expect(screen.getAllByRole('status')).toHaveLength(1);
		expect(within(announcer()).queryByText('Title W1')).toBeNull();
	});

	it('does not announce the warnings present at first paint', async () => {
		render(AdminWarningList, { props: { warnings: [warning('W1', 'warn')], announceDelay: 10 } });
		await sleep(40);
		expect(announcer()).toHaveTextContent('');
	});

	it('announces only a warning that appears after mount, once, after the debounce', async () => {
		const { rerender } = render(AdminWarningList, {
			props: { warnings: [warning('W1', 'warn')], announceDelay: 30 }
		});
		await tick();
		await rerender({ warnings: [warning('W1', 'warn'), warning('W2', 'warn')], announceDelay: 30 });
		expect(announcer()).toHaveTextContent(''); // still debouncing
		await waitFor(() => expect(announcer()).toHaveTextContent('Title W2. Message W2.'));
		expect(announcer().textContent).not.toContain('W1');
	});

	it('does not announce a warning that flickers away before the debounce ends', async () => {
		const { rerender } = render(AdminWarningList, {
			props: { warnings: [], announceDelay: 30 }
		});
		await tick();
		await rerender({ warnings: [warning('W2', 'warn')], announceDelay: 30 });
		await rerender({ warnings: [], announceDelay: 30 });
		await sleep(80);
		expect(announcer()).toHaveTextContent('');
	});

	it('shows a dismiss button only for Info warnings of a saved entity', () => {
		const { unmount } = render(AdminWarningList, {
			props: { warnings: [warning('W1', 'warn'), warning('I1', 'info')], entityId: 'ev-1' }
		});
		expect(screen.getAllByRole('button', { name: /^Dismiss:/ })).toHaveLength(1);
		const dismiss = screen.getByRole('button', { name: 'Dismiss: Title I1' });
		expect(dismiss).toHaveAccessibleDescription('Message I1.');
		unmount();

		render(AdminWarningList, { props: { warnings: [warning('I1', 'info')] } });
		expect(screen.queryByRole('button', { name: /^Dismiss:/ })).toBeNull();
	});

	it('dismisses an Info warning, stores it, and moves focus to the next callout', async () => {
		render(AdminWarningList, {
			props: {
				warnings: [
					warning('I1', 'info'),
					warning('W1', 'warn', { fixTarget: 'field-x', fixLabel: () => 'Fix it' })
				],
				entityId: 'ev-1'
			}
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Dismiss: Title I1' }));
		await waitFor(() => expect(screen.queryByText('Title I1')).toBeNull());
		expect(JSON.parse(localStorage.getItem(DISMISSED_STORAGE_KEY) ?? '{}')).toEqual({
			'ev-1:I1': true
		});
		expect(screen.getByRole('link', { name: 'Fix it' })).toHaveFocus();
		// A dismissal is not announced.
		expect(announcer()).toHaveTextContent('');
	});

	it('moves focus to the list container when the last warning is dismissed', async () => {
		render(AdminWarningList, { props: { warnings: [warning('I1', 'info')], entityId: 'ev-1' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Dismiss: Title I1' }));
		await waitFor(() => expect(screen.getByTestId('admin-warning-list')).toHaveFocus());
		expect(screen.queryByRole('list')).toBeNull();
	});

	it('hides a warning dismissed earlier in this browser, after mount', async () => {
		localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify({ 'ev-1:I1': true }));
		render(AdminWarningList, {
			props: { warnings: [warning('I1', 'info'), warning('W1', 'warn')], entityId: 'ev-1' }
		});
		await waitFor(() => expect(screen.queryByText('Title I1')).toBeNull());
		expect(screen.getByText('Title W1')).toBeInTheDocument();
	});

	it('keeps a dismissal to its own entity', async () => {
		localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify({ 'ev-1:I1': true }));
		render(AdminWarningList, {
			props: { warnings: [warning('I1', 'info')], entityId: 'ev-2' }
		});
		await tick();
		expect(screen.getByText('Title I1')).toBeInTheDocument();
	});

	it('focuses the fix target when it exists and runs the in-place action', async () => {
		const run = vi.fn();
		const field = document.createElement('input');
		field.id = 'field-x';
		const scroll = vi.fn();
		field.scrollIntoView = scroll; // jsdom has no layout
		document.body.appendChild(field);
		render(AdminWarningList, {
			props: {
				warnings: [
					warning('W1', 'warn', {
						fixTarget: 'field-x',
						fixLabel: () => 'Go to field',
						action: { label: () => 'Clear deadline', run }
					})
				]
			}
		});
		const link = screen.getByRole('link', { name: 'Go to field' });
		expect(link).toHaveAttribute('href', '#field-x');
		await fireEvent.click(link);
		expect(field).toHaveFocus();
		expect(scroll).toHaveBeenCalledWith({ block: 'center' });
		await fireEvent.click(screen.getByRole('button', { name: 'Clear deadline' }));
		expect(run).toHaveBeenCalledOnce();
		field.remove();
	});

	it('keeps the link default (hash scroll) when the fix target is missing', async () => {
		render(AdminWarningList, {
			props: {
				warnings: [warning('W1', 'warn', { fixTarget: 'nowhere', fixLabel: () => 'Go' })]
			}
		});
		const link = screen.getByRole('link', { name: 'Go' });
		const event = new MouseEvent('click', { bubbles: true, cancelable: true });
		link.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(false);
	});

	it('moves focus on when an in-place action removes its own warning', async () => {
		const other = warning('W2', 'warn', { fixTarget: 'x', fixLabel: () => 'Fix W2' });
		const holder: { rerender?: (p: { warnings: AdminWarning[] }) => Promise<void> } = {};
		const clearing = warning('W1', 'warn', {
			action: {
				label: () => 'Clear deadline',
				run: async () => holder.rerender?.({ warnings: [other] })
			}
		});
		const { rerender } = render(AdminWarningList, { props: { warnings: [clearing, other] } });
		holder.rerender = rerender;
		const button = screen.getByRole('button', { name: 'Clear deadline' });
		button.focus();
		await fireEvent.click(button);
		await waitFor(() => expect(screen.getByRole('link', { name: 'Fix W2' })).toHaveFocus());
	});

	it('keeps focus when an in-place action leaves its warning in place', async () => {
		render(AdminWarningList, {
			props: {
				warnings: [warning('W1', 'warn', { action: { label: () => 'Retry', run: vi.fn() } })]
			}
		});
		const button = screen.getByRole('button', { name: 'Retry' });
		button.focus();
		await fireEvent.click(button);
		await tick();
		expect(button).toHaveFocus();
	});
	it('does not announce warnings that arrive with the data once the baseline is ready', async () => {
		const { rerender } = render(AdminWarningList, {
			props: { warnings: [], baselineReady: false, announceDelay: 10 }
		});
		await tick();
		await rerender({ warnings: [warning('C4', 'warn')], baselineReady: true, announceDelay: 10 });
		await sleep(50);
		expect(announcer()).toHaveTextContent('');
		// A warning that appears after that IS announced.
		await rerender({
			warnings: [warning('C4', 'warn'), warning('C3a', 'info')],
			baselineReady: true,
			announceDelay: 10
		});
		await waitFor(() => expect(announcer()).toHaveTextContent('Title C3a.'));
	});

	it('skips a callout without controls and focuses the nearest control', async () => {
		render(AdminWarningList, {
			props: {
				warnings: [
					warning('I1', 'info'),
					warning('W1', 'warn'),
					warning('W2', 'warn', { fixTarget: 'x', fixLabel: () => 'Fix W2' })
				],
				entityId: 'ev-1'
			}
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Dismiss: Title I1' }));
		await waitFor(() => expect(screen.getByRole('link', { name: 'Fix W2' })).toHaveFocus());
	});

	it('focuses the fallback field when no callout control is left', async () => {
		const field = document.createElement('input');
		field.id = 'fallback-field';
		document.body.appendChild(field);
		render(AdminWarningList, {
			props: {
				warnings: [warning('I1', 'info'), warning('W1', 'warn')],
				entityId: 'ev-1',
				fallbackFocusId: 'fallback-field'
			}
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Dismiss: Title I1' }));
		await waitFor(() => expect(field).toHaveFocus());
		field.remove();
	});

	it('renders an explicit list role, a custom label and sr-only action context', () => {
		render(AdminWarningList, {
			props: {
				label: 'Setting warnings: VIP',
				warnings: [
					warning('D1', 'warn', {
						action: { label: () => 'Edit tier', srContext: () => 'VIP', run: vi.fn() }
					})
				]
			}
		});
		const list = screen.getByRole('list', { name: 'Setting warnings: VIP' });
		expect(list).toHaveAttribute('role', 'list');
		expect(screen.getByRole('button', { name: 'Edit tier (VIP)' })).toBeInTheDocument();
	});
	it('focuses the first focusable element inside a non-focusable fallback wrapper', async () => {
		const wrapper = document.createElement('div');
		wrapper.id = 'fallback-wrapper';
		const editor = document.createElement('div');
		editor.setAttribute('contenteditable', 'true');
		editor.tabIndex = 0;
		wrapper.appendChild(editor);
		document.body.appendChild(wrapper);
		render(AdminWarningList, {
			props: {
				warnings: [warning('I1', 'info')],
				entityId: 'ev-1',
				fallbackFocusId: 'fallback-wrapper'
			}
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Dismiss: Title I1' }));
		await waitFor(() => expect(editor).toHaveFocus());
		wrapper.remove();
	});
});
