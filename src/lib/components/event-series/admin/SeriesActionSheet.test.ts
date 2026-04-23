import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import SeriesActionSheet from './SeriesActionSheet.svelte';

function baseProps(overrides: Record<string, unknown> = {}) {
	return {
		isOpen: true,
		isPaused: false,
		actionsDisabled: false,
		pauseResumeDisabled: false,
		onClose: vi.fn(),
		onSeriesSettings: vi.fn(),
		onEditTemplate: vi.fn(),
		onEditRecurrence: vi.fn(),
		onCancelOccurrence: vi.fn(),
		onGenerateNow: vi.fn(),
		onPauseResume: vi.fn(),
		...overrides
	};
}

describe('SeriesActionSheet', () => {
	beforeEach(() => {
		// jsdom doesn't reset body style between tests; clear it so the body-
		// scroll-lock effect starts clean on every render.
		document.body.style.overflow = '';
	});

	afterEach(() => {
		document.body.style.overflow = '';
	});

	it('does not render the sheet when isOpen=false', () => {
		render(SeriesActionSheet, { props: baseProps({ isOpen: false }) });
		expect(screen.queryByTestId('series-action-sheet')).toBeNull();
	});

	it('renders the sheet with dialog role and modal semantics when isOpen=true', () => {
		render(SeriesActionSheet, { props: baseProps() });
		const dialog = screen.getByTestId('series-action-sheet');
		expect(dialog.getAttribute('role')).toBe('dialog');
		expect(dialog.getAttribute('aria-modal')).toBe('true');
		expect(dialog.getAttribute('aria-labelledby')).toBe('series-action-sheet-title');
		// The element must be programmatically focusable so focus-trap / keyboard
		// navigation semantics work; svelte-check refuses role="dialog" without it.
		expect(dialog.getAttribute('tabindex')).toBe('-1');
	});

	it('renders all six action rows when open', () => {
		render(SeriesActionSheet, { props: baseProps() });
		expect(screen.getByTestId('action-series-settings')).toBeInTheDocument();
		expect(screen.getByTestId('action-edit-template')).toBeInTheDocument();
		expect(screen.getByTestId('action-edit-recurrence')).toBeInTheDocument();
		expect(screen.getByTestId('action-cancel-occurrence')).toBeInTheDocument();
		expect(screen.getByTestId('action-generate-now')).toBeInTheDocument();
		expect(screen.getByTestId('action-pause-resume')).toBeInTheDocument();
	});

	it('locks body scroll while open', () => {
		render(SeriesActionSheet, { props: baseProps() });
		expect(document.body.style.overflow).toBe('hidden');
	});

	it('does not lock body scroll when isOpen=false', () => {
		render(SeriesActionSheet, { props: baseProps({ isOpen: false }) });
		expect(document.body.style.overflow).toBe('');
	});

	it('restores body scroll when the component unmounts', () => {
		const { unmount } = render(SeriesActionSheet, { props: baseProps() });
		expect(document.body.style.overflow).toBe('hidden');
		unmount();
		expect(document.body.style.overflow).toBe('');
	});

	it('disables rule/template-dependent actions when actionsDisabled=true', () => {
		render(SeriesActionSheet, { props: baseProps({ actionsDisabled: true }) });
		// Series-settings is intentionally always enabled inside the sheet; the
		// sheet itself only mounts under canEdit, so the settings entry point is
		// independent of the degraded-state gate.
		expect((screen.getByTestId('action-series-settings') as HTMLButtonElement).disabled).toBe(
			false
		);
		expect((screen.getByTestId('action-edit-template') as HTMLButtonElement).disabled).toBe(true);
		expect((screen.getByTestId('action-edit-recurrence') as HTMLButtonElement).disabled).toBe(true);
		expect((screen.getByTestId('action-cancel-occurrence') as HTMLButtonElement).disabled).toBe(
			true
		);
		expect((screen.getByTestId('action-generate-now') as HTMLButtonElement).disabled).toBe(true);
	});

	it('disables pause/resume independently via pauseResumeDisabled', () => {
		render(SeriesActionSheet, { props: baseProps({ pauseResumeDisabled: true }) });
		expect((screen.getByTestId('action-pause-resume') as HTMLButtonElement).disabled).toBe(true);
	});

	it('shows the Resume label/icon when isPaused=true', () => {
		render(SeriesActionSheet, { props: baseProps({ isPaused: true }) });
		// The label text uses the resume copy when paused.
		expect(screen.getByTestId('action-pause-resume').textContent).toMatch(/resume/i);
	});

	it('shows the Pause label/icon when isPaused=false', () => {
		render(SeriesActionSheet, { props: baseProps({ isPaused: false }) });
		expect(screen.getByTestId('action-pause-resume').textContent).toMatch(/pause/i);
	});

	it('fires onClose when the close (X) button is clicked', async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(SeriesActionSheet, { props: baseProps({ onClose }) });

		await user.click(screen.getByTestId('series-action-sheet-close'));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('invokes the action handler AND onClose on action click (runAndClose)', async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onSeriesSettings = vi.fn();
		render(SeriesActionSheet, { props: baseProps({ onClose, onSeriesSettings }) });

		await user.click(screen.getByTestId('action-series-settings'));
		expect(onSeriesSettings).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
		// Handler must run before the sheet closes so downstream dialogs can claim
		// the foreground after the bottom sheet is dismissed.
		const handlerOrder = onSeriesSettings.mock.invocationCallOrder[0];
		const closeOrder = onClose.mock.invocationCallOrder[0];
		expect(handlerOrder).toBeLessThan(closeOrder);
	});

	it('closes on Escape keydown', async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(SeriesActionSheet, { props: baseProps({ onClose }) });

		await user.keyboard('{Escape}');
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('does not fire onClose for Escape when the sheet is already closed', async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(SeriesActionSheet, { props: baseProps({ isOpen: false, onClose }) });

		await user.keyboard('{Escape}');
		expect(onClose).not.toHaveBeenCalled();
	});
});
