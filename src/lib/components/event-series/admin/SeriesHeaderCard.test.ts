import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import SeriesHeaderCard from './SeriesHeaderCard.svelte';
import type {
	EventSeriesRecurrenceDetailSchema,
	RecurrenceRuleSchema,
	MinimalEventSchema
} from '$lib/api/generated/types.gen';

function makeRule(overrides: Partial<RecurrenceRuleSchema> = {}): RecurrenceRuleSchema {
	return {
		id: 'rr_1',
		frequency: 'weekly',
		interval: 1,
		weekdays: [0],
		monthly_type: null,
		day_of_month: null,
		nth_weekday: null,
		weekday: null,
		dtstart: '2026-05-01T18:00:00Z',
		until: null,
		count: null,
		timezone: 'UTC',
		rrule_string: 'RRULE:FREQ=WEEKLY;BYDAY=MO',
		...overrides
	};
}

function makeTemplate(overrides: Partial<MinimalEventSchema> = {}): MinimalEventSchema {
	return {
		id: 'evt_template',
		slug: 'weekly-run',
		name: 'Weekly Run (template)',
		logo_thumbnail_url: null,
		cover_art_thumbnail_url: null,
		cover_art_social_url: null,
		...overrides
	} as MinimalEventSchema;
}

function makeSeries(
	overrides: Partial<EventSeriesRecurrenceDetailSchema> = {}
): EventSeriesRecurrenceDetailSchema {
	return {
		id: 'ser_1',
		name: 'Weekly Run Club',
		slug: 'weekly-run-club',
		description: 'Every Monday at 6pm.',
		is_active: true,
		auto_publish: false,
		generation_window_weeks: 8,
		exdates: [],
		last_generated_until: '2026-07-01T18:00:00Z',
		recurrence_rule: makeRule(),
		template_event: makeTemplate(),
		...overrides
	};
}

describe('SeriesHeaderCard', () => {
	it('renders the series name as the page heading', () => {
		render(SeriesHeaderCard, { props: { series: makeSeries() } });
		const heading = screen.getByRole('heading', { level: 1 });
		expect(heading.textContent).toContain('Weekly Run Club');
	});

	it('renders the description when present', () => {
		render(SeriesHeaderCard, { props: { series: makeSeries() } });
		expect(screen.getByText('Every Monday at 6pm.')).toBeInTheDocument();
	});

	it('omits the description block when absent', () => {
		render(SeriesHeaderCard, {
			props: { series: makeSeries({ description: null }) }
		});
		expect(screen.queryByText('Every Monday at 6pm.')).toBeNull();
	});

	it('shows the Active status pill when series is_active=true', () => {
		render(SeriesHeaderCard, { props: { series: makeSeries() } });
		// The pill uses aria-label to carry the status string.
		expect(screen.getByLabelText(/active/i)).toBeInTheDocument();
	});

	it('shows the Paused status pill when series is_active=false', () => {
		render(SeriesHeaderCard, {
			props: { series: makeSeries({ is_active: false }) }
		});
		expect(screen.getByLabelText(/paused/i)).toBeInTheDocument();
	});

	it('renders the recurrence summary when a rule is present', () => {
		const { container } = render(SeriesHeaderCard, {
			props: { series: makeSeries() }
		});
		// RecurrenceSummary is a child component; its live region uses aria-live.
		const live = container.querySelector('[aria-live="polite"]');
		expect(live).not.toBeNull();
		expect(live?.textContent ?? '').toMatch(/monday/i);
	});

	it('hides the action row when canEdit=false', () => {
		render(SeriesHeaderCard, {
			props: { series: makeSeries(), canEdit: false }
		});
		// The whole {#if canEdit} block guards both action trees + the sheet.
		expect(screen.queryByTestId('action-series-settings')).toBeNull();
		expect(screen.queryByTestId('action-sheet-trigger')).toBeNull();
	});

	it('renders both desktop action buttons and mobile trigger when canEdit=true', () => {
		render(SeriesHeaderCard, {
			props: { series: makeSeries(), canEdit: true }
		});
		// Same testid on desktop row + the inside-sheet action; the sheet action
		// isn't in the DOM until the trigger opens it, so only the desktop one
		// shows up before interaction.
		expect(screen.getAllByTestId('action-series-settings')).toHaveLength(1);
		expect(screen.getByTestId('action-sheet-trigger')).toBeInTheDocument();
	});

	it('disables template/recurrence/cancel/generate in degraded state (no rule)', () => {
		render(SeriesHeaderCard, {
			props: {
				series: makeSeries({ recurrence_rule: null }),
				canEdit: true
			}
		});
		// Series-settings stays enabled — it only depends on canEdit.
		expect((screen.getByTestId('action-series-settings') as HTMLButtonElement).disabled).toBe(
			false
		);
		expect((screen.getByTestId('action-edit-template') as HTMLButtonElement).disabled).toBe(true);
		expect((screen.getByTestId('action-edit-recurrence') as HTMLButtonElement).disabled).toBe(true);
		expect((screen.getByTestId('action-cancel-occurrence') as HTMLButtonElement).disabled).toBe(
			true
		);
		expect((screen.getByTestId('action-generate-now') as HTMLButtonElement).disabled).toBe(true);
		expect((screen.getByTestId('action-pause-resume') as HTMLButtonElement).disabled).toBe(true);
	});

	it('disables template-dependent actions when template_event is missing', () => {
		render(SeriesHeaderCard, {
			props: {
				series: makeSeries({ template_event: null }),
				canEdit: true
			}
		});
		expect((screen.getByTestId('action-edit-template') as HTMLButtonElement).disabled).toBe(true);
	});

	it('fires onSeriesSettings when the Series settings button is clicked', async () => {
		const user = userEvent.setup();
		const onSeriesSettings = vi.fn();
		render(SeriesHeaderCard, {
			props: { series: makeSeries(), canEdit: true, onSeriesSettings }
		});
		await user.click(screen.getByTestId('action-series-settings'));
		expect(onSeriesSettings).toHaveBeenCalledTimes(1);
	});

	it('opens the mobile action sheet when the trigger is clicked', async () => {
		const user = userEvent.setup();
		render(SeriesHeaderCard, {
			props: { series: makeSeries(), canEdit: true }
		});

		expect(screen.queryByTestId('series-action-sheet')).toBeNull();

		await user.click(screen.getByTestId('action-sheet-trigger'));

		expect(screen.getByTestId('series-action-sheet')).toBeInTheDocument();
		// Now the sheet is also rendered — expect TWO series-settings buttons
		// (desktop row + sheet item); this is the deliberate duplicate-testid
		// pattern called out in the PRD.
		expect(screen.getAllByTestId('action-series-settings')).toHaveLength(2);
	});

	it('shows the auto-publish-off pill copy when auto_publish=false', () => {
		const { container } = render(SeriesHeaderCard, {
			props: { series: makeSeries({ auto_publish: false }) }
		});
		// Key: recurringEvents.dashboard.autoPublishOff — "Review each draft".
		expect(container.textContent).toMatch(/review each draft/i);
	});

	it('shows the auto-publish-on pill copy when auto_publish=true', () => {
		const { container } = render(SeriesHeaderCard, {
			props: { series: makeSeries({ auto_publish: true }) }
		});
		// Key: recurringEvents.dashboard.autoPublishOn — "Auto-publish on".
		expect(container.textContent).toMatch(/auto-publish on/i);
	});
});
