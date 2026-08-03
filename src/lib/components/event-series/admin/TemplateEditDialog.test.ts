import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import TemplateEditDialog from './TemplateEditDialog.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import { VISIBILITY_DEFAULTS } from '$lib/utils/event-visibility';
import type {
	EventDetailSchema,
	EventSeriesRecurrenceDetailSchema,
	MinimalEventSchema,
	MinimalOrganizationSchema
} from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminrecurringeventsGetSeriesTemplateEvent: vi.fn(),
	organizationadminrecurringeventsUpdateTemplate: vi.fn()
}));
vi.mock('svelte-sonner', () => ({
	toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() }
}));

import {
	organizationadminrecurringeventsGetSeriesTemplateEvent,
	organizationadminrecurringeventsUpdateTemplate
} from '$lib/api/generated/sdk.gen';

// --- Fixtures -----------------------------------------------------------

function makeOrganization(
	overrides: Partial<MinimalOrganizationSchema> = {}
): MinimalOrganizationSchema {
	return {
		id: 'org_1',
		name: 'Acme Running Club',
		slug: 'acme',
		...overrides
	};
}

/**
 * A template event with every relocated visibility field at its backend
 * default (`address_visibility: 'public'`, `show_pronoun_distribution: false`)
 * unless overridden — mirrors what `EventDetailSchema` always serializes.
 */
function makeTemplateEvent(overrides: Partial<EventDetailSchema> = {}): EventDetailSchema {
	return {
		id: 'evt_template',
		event_type: 'public',
		visibility: 'public',
		organization: makeOrganization(),
		status: 'open',
		name: 'Weekly Run',
		slug: 'weekly-run',
		start: '2026-08-01T18:00:00Z',
		end: '2026-08-01T20:00:00Z',
		timezone: 'UTC',
		requires_ticket: false,
		requires_full_profile: false,
		potluck_open: false,
		accept_invitation_requests: false,
		accept_rsvp_notes: false,
		can_attend_without_login: false,
		require_ticket_names: true,
		visibility_settings: { ...VISIBILITY_DEFAULTS },
		...overrides
	};
}

function makeMinimalTemplate(overrides: Partial<MinimalEventSchema> = {}): MinimalEventSchema {
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
		recurrence_rule: null,
		template_event: makeMinimalTemplate(),
		...overrides
	};
}

// --- Harness --------------------------------------------------------------

describe('TemplateEditDialog', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
		vi.clearAllMocks();
		vi.mocked(organizationadminrecurringeventsUpdateTemplate).mockResolvedValue({
			data: makeTemplateEvent(),
			request: new Request('http://test'),
			response: new Response()
		} as never);
	});

	function renderDialog(
		templateEvent: EventDetailSchema,
		seriesOverrides: Partial<EventSeriesRecurrenceDetailSchema> = {}
	) {
		vi.mocked(organizationadminrecurringeventsGetSeriesTemplateEvent).mockResolvedValue({
			data: templateEvent,
			request: new Request('http://test'),
			response: new Response()
		} as never);

		const onClose = vi.fn();
		const result = render(QueryClientTestWrapper, {
			props: {
				client: queryClient,
				component: TemplateEditDialog,
				componentProps: {
					open: true,
					series: makeSeries(seriesOverrides),
					organizationSlug: 'acme',
					accessToken: 'test-token',
					onClose
				}
			}
		});
		return { ...result, onClose };
	}

	async function waitForLoaded() {
		await waitFor(() =>
			expect(screen.getByTestId('template-edit-address-visibility')).toBeInTheDocument()
		);
	}

	function addressVisibilitySelect() {
		return screen.getByTestId('template-edit-address-visibility') as HTMLSelectElement;
	}

	function pronounCheckbox() {
		return screen.getByTestId('template-edit-public-pronoun-distribution') as HTMLInputElement;
	}

	function latestPatchBody(): Record<string, unknown> {
		const calls = vi.mocked(organizationadminrecurringeventsUpdateTemplate).mock.calls;
		const last = calls[calls.length - 1]?.[0] as { body?: Record<string, unknown> } | undefined;
		return (last?.body ?? {}) as Record<string, unknown>;
	}

	// --- 1. Seeding ---------------------------------------------------------

	it('seeds the address-visibility select and pronoun checkbox from the relocated fields', async () => {
		renderDialog(
			makeTemplateEvent({
				visibility_settings: {
					...VISIBILITY_DEFAULTS,
					address_visibility: 'members-only',
					show_pronoun_distribution: true
				}
			})
		);
		await waitForLoaded();

		expect(addressVisibilitySelect().value).toBe('members-only');
		expect(pronounCheckbox().checked).toBe(true);
	});

	// --- 2. Payload shape -----------------------------------------------------

	it('nests edited address visibility and pronoun distribution under visibility_settings, never at the top level', async () => {
		const user = userEvent.setup();
		renderDialog(makeTemplateEvent()); // both relocated fields at their defaults
		await waitForLoaded();

		await user.selectOptions(addressVisibilitySelect(), 'private');
		await user.click(pronounCheckbox());

		await user.click(screen.getByTestId('template-edit-continue'));
		await user.click(screen.getByTestId('template-edit-apply'));

		await waitFor(() =>
			expect(organizationadminrecurringeventsUpdateTemplate).toHaveBeenCalledTimes(1)
		);
		const body = latestPatchBody();

		expect(body).toMatchObject({
			visibility_settings: { address_visibility: 'private', show_pronoun_distribution: true }
		});
		// The 422 guard: TemplateEditSchema is extra="forbid" — these must never
		// appear as top-level keys, only nested under visibility_settings.
		expect(body).not.toHaveProperty('address_visibility');
		expect(body).not.toHaveProperty('public_pronoun_distribution');
		expect(body).not.toHaveProperty('show_pronoun_distribution');
	});

	// --- 3. Preset changes preserve both relocated values ----------------------

	it('preserves a non-default address_visibility and show_pronoun_distribution across a preset click', async () => {
		const user = userEvent.setup();
		// Seed with the toggles at the "discreet" combination and both relocated
		// fields at non-default values, so clicking "Open" changes the toggles
		// (producing a real diff) while leaving the relocated fields untouched.
		renderDialog(
			makeTemplateEvent({
				visibility_settings: {
					show_attendee_count: false,
					show_capacity: false,
					show_attendee_list: false,
					address_visibility: 'private',
					show_pronoun_distribution: true
				}
			})
		);
		await waitForLoaded();

		expect(addressVisibilitySelect().value).toBe('private');
		expect(pronounCheckbox().checked).toBe(true);

		await user.click(screen.getByTestId('visibility-preset-open'));

		// The preset only emits the three toggle keys; the merge must leave the
		// other two exactly as they were — a regression that assigns instead of
		// merges silently resets them to the backend defaults ('public' / false).
		expect(addressVisibilitySelect().value).toBe('private');
		expect(pronounCheckbox().checked).toBe(true);

		await user.click(screen.getByTestId('template-edit-continue'));
		await user.click(screen.getByTestId('template-edit-apply'));

		await waitFor(() =>
			expect(organizationadminrecurringeventsUpdateTemplate).toHaveBeenCalledTimes(1)
		);
		const body = latestPatchBody();
		const visibilitySettings = body.visibility_settings as Record<string, unknown>;

		// The toggles changed (open preset) so they must be present...
		expect(visibilitySettings).toMatchObject({
			show_attendee_count: true,
			show_capacity: true,
			show_attendee_list: true
		});
		// ...but address_visibility/show_pronoun_distribution never changed from
		// their seeded values, so a correct diff omits them entirely. Were the
		// merge broken, they'd show up here reset to the defaults instead.
		expect(visibilitySettings).not.toHaveProperty('address_visibility');
		expect(visibilitySettings).not.toHaveProperty('show_pronoun_distribution');
	});

	// --- 4. require_ticket_names toggle ----------------------------------------

	it('seeds require_ticket_names from the template and sends only that flag when toggled off', async () => {
		const user = userEvent.setup();
		renderDialog(makeTemplateEvent({ require_ticket_names: true }));
		await waitForLoaded();

		const toggle = screen.getByTestId('template-edit-require-ticket-names') as HTMLInputElement;
		expect(toggle.checked).toBe(true);

		await user.click(toggle);
		expect(toggle.checked).toBe(false);

		await user.click(screen.getByTestId('template-edit-continue'));
		await user.click(screen.getByTestId('template-edit-apply'));

		await waitFor(() =>
			expect(organizationadminrecurringeventsUpdateTemplate).toHaveBeenCalledTimes(1)
		);
		const body = latestPatchBody();

		// Only the flag the user actually changed travels — the diff must not
		// re-send every other unchanged field.
		expect(body).toEqual({ require_ticket_names: false });
	});

	// --- 5. No-op suppression --------------------------------------------------

	it('disables Continue and never mutates when the dialog is applied without edits', async () => {
		renderDialog(makeTemplateEvent());
		await waitForLoaded();

		const continueButton = screen.getByTestId('template-edit-continue') as HTMLButtonElement;
		expect(continueButton.disabled).toBe(true);

		// Disabled native buttons don't dispatch click handlers; this documents
		// that the dialog never reaches the propagation step or mutation without
		// a real edit having occurred.
		expect(screen.queryByTestId('template-edit-apply')).toBeNull();
		expect(organizationadminrecurringeventsUpdateTemplate).not.toHaveBeenCalled();
	});
});
