import { render, screen, within } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import { readable } from 'svelte/store';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import { resetDismissedForTests } from '$lib/utils/admin-warnings/dismissed.svelte';
import Page from './+page.svelte';

vi.mock('$app/stores', () => ({
	page: readable({ data: { features: { telegram: true } } })
}));
vi.mock('$app/forms', () => ({ enhance: () => ({ destroy: vi.fn() }) }));
vi.mock('$app/navigation', () => ({
	goto: vi.fn(),
	invalidateAll: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('$lib/api/generated', () => ({}));

const COUNTS = { publicEventCount: 3, inSeriesCount: 0, partial: false };

function makeOrg(over: Record<string, unknown> = {}) {
	return {
		id: 'org-1',
		slug: 'acme',
		name: 'Acme',
		visibility: 'members-only',
		accept_membership_requests: false,
		contact_method: 'none',
		revenue_report_cadence: 'none',
		default_membership_questionnaire_id: null,
		default_requires_membership_approval: false,
		custom_domain: null,
		tags: [],
		...over
	};
}

function setup(over: {
	org?: Record<string, unknown>;
	warningCounts?: unknown;
	questionnaires?: unknown[];
}) {
	return render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: Page,
			componentProps: {
				data: {
					organization: makeOrg(over.org),
					membershipQuestionnaires: over.questionnaires ?? [],
					warningCounts: over.warningCounts === undefined ? COUNTS : over.warningCounts,
					continueSetupHref: null
				},
				form: null
			}
		}
	});
}

const oq = (id: string, status: string) => ({
	id,
	questionnaire_type: 'membership',
	questionnaire: { name: `Q ${id}`, status }
});

describe('org settings: warnings', () => {
	beforeEach(() => {
		localStorage.clear();
		resetDismissedForTests();
	});

	it('shows A1 as a Warn with the count while the visibility is restricted', () => {
		setup({});
		const list = screen.getByTestId('org-visibility-warnings');
		expect(within(list).getByText('Visitors see events of a hidden organization')).toBeTruthy();
		expect(list.textContent).toContain('Upcoming events that visitors can see: 3.');
		expect(list.querySelector('[data-tone="warning"]')).not.toBeNull();
		// Warn is never dismissible.
		expect(within(list).queryByRole('button', { name: /dismiss/i })).toBeNull();
	});

	it('removes A1 when the visibility changes to public, and brings it back', async () => {
		const user = userEvent.setup();
		setup({});
		const list = screen.getByTestId('org-visibility-warnings');
		const select = screen.getByLabelText('Visibility');
		await user.selectOptions(select, 'public');
		expect(within(list).queryByText('Visitors see events of a hidden organization')).toBeNull();
		await user.selectOptions(select, 'staff-only');
		expect(within(list).getByText('Visitors see events of a hidden organization')).toBeTruthy();
	});

	it('shows no A1 when the counts failed to load', () => {
		setup({ warningCounts: null });
		const list = screen.getByTestId('org-visibility-warnings');
		expect(within(list).queryByRole('listitem')).toBeNull();
	});

	it('still fires for a private organization (not in the select)', () => {
		setup({ org: { visibility: 'private' } });
		const list = screen.getByTestId('org-visibility-warnings');
		expect(within(list).getByText('Visitors see events of a hidden organization')).toBeTruthy();
	});

	it('shows A5 (Info, dismissible) for an active custom domain on a restricted org', () => {
		setup({ org: { custom_domain: 'events.acme.test' }, warningCounts: null });
		const list = screen.getByTestId('org-visibility-warnings');
		expect(within(list).getByText('The custom domain shows a hidden organization')).toBeTruthy();
		expect(within(list).getByRole('button', { name: /dismiss/i })).toBeTruthy();
	});

	it('shows A4 under the accept-requests help only while the toggle is on', async () => {
		const user = userEvent.setup();
		setup({});
		const list = screen.getByTestId('org-requests-warnings');
		expect(within(list).queryByRole('listitem')).toBeNull();
		await user.click(screen.getByLabelText(/accept membership requests|accept new members/i));
		expect(within(list).getByText('Membership requests are not reachable')).toBeTruthy();
	});

	it('shows F2 (Info) for a draft default questionnaire with a questionnaire-specific id', () => {
		setup({
			org: { default_membership_questionnaire_id: 'oq-1' },
			questionnaires: [oq('oq-1', 'draft')]
		});
		const list = screen.getByTestId('org-questionnaire-warnings');
		expect(within(list).getByText('Membership questionnaire is not published')).toBeTruthy();
		expect(list.querySelector('[data-tone="info"]')).not.toBeNull();
	});

	it('shows no F2 for a published default questionnaire or none', () => {
		setup({
			org: { default_membership_questionnaire_id: 'oq-1' },
			questionnaires: [oq('oq-1', 'published')]
		});
		expect(
			within(screen.getByTestId('org-questionnaire-warnings')).queryByRole('listitem')
		).toBeNull();
	});

	it('dismissal of F2 follows the chosen questionnaire', async () => {
		const user = userEvent.setup();
		setup({
			org: { default_membership_questionnaire_id: 'oq-1' },
			questionnaires: [oq('oq-1', 'draft'), oq('oq-2', 'draft')]
		});
		const list = screen.getByTestId('org-questionnaire-warnings');
		await user.click(within(list).getByRole('button', { name: /dismiss/i }));
		expect(within(list).queryByRole('listitem')).toBeNull();
		await user.selectOptions(screen.getByLabelText(/default.*questionnaire/i), 'oq-2');
		expect(within(list).getByText('Membership questionnaire is not published')).toBeTruthy();
	});
});
