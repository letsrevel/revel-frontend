import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QuestionnaireCard from './QuestionnaireCard.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type {
	MinimalEventSchema,
	OrganizationQuestionnaireInListSchema,
	QuestionnaireType
} from '$lib/api/generated';

// The mock must cover every operation the card's transitive component tree
// imports, not just the card's own two — the assignment modal pulls four more.
vi.mock('$lib/api/generated/sdk.gen', () => ({
	questionnaireDeleteOrgQuestionnaire: vi.fn(),
	questionnaireGetOrgQuestionnaire: vi.fn(),
	questionnaireDuplicateOrgQuestionnaire: vi.fn(),
	questionnaireReplaceEvents: vi.fn(),
	questionnaireReplaceEventSeries: vi.fn(),
	eventpublicdiscoveryListEvents: vi.fn(),
	eventseriesListEventSeries: vi.fn()
}));
vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' as string | null }
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidateAll: vi.fn() }));

function makeEvent(name: string, id: string): MinimalEventSchema {
	return {
		id,
		slug: id,
		name,
		start: '2026-01-01T10:00:00Z',
		end: '2026-01-01T12:00:00Z'
	};
}

function makeQuestionnaire(
	questionnaire_type: QuestionnaireType,
	overrides: Partial<OrganizationQuestionnaireInListSchema> = {}
): OrganizationQuestionnaireInListSchema {
	return {
		id: 'oq-1',
		events: [],
		event_series: [],
		tiers: [],
		is_organization_default: false,
		questionnaire_type,
		members_exempt: false,
		per_event: false,
		requires_evaluation: false,
		pending_evaluations_count: 0,
		questionnaire: {
			id: 'q-1',
			name: 'Membership application',
			status: 'published',
			min_score: '0.00',
			evaluation_mode: 'manual'
		},
		...overrides
	};
}

describe('QuestionnaireCard', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
		vi.clearAllMocks();
	});

	function renderCard(questionnaire: OrganizationQuestionnaireInListSchema) {
		return render(QueryClientTestWrapper, {
			props: {
				client: queryClient,
				component: QuestionnaireCard,
				componentProps: {
					questionnaire,
					organizationSlug: 'acme',
					organizationId: 'org-1',
					accessToken: 'test-token'
				}
			}
		});
	}

	describe('membership questionnaires', () => {
		it('offers no "Assign to Events" action', () => {
			renderCard(makeQuestionnaire('membership'));

			expect(screen.queryByRole('button', { name: /assign to events/i })).not.toBeInTheDocument();
		});

		it('links to Members → Tiers and to the organization settings', () => {
			renderCard(makeQuestionnaire('membership'));

			expect(screen.getByRole('link', { name: /assign to membership tiers/i })).toHaveAttribute(
				'href',
				'/org/acme/admin/members?tab=tiers'
			);
			expect(
				screen.getByRole('link', { name: /organization membership settings/i })
			).toHaveAttribute('href', '/org/acme/admin/settings');
		});

		it('summarises tier usage instead of the event assignment count', () => {
			renderCard(
				makeQuestionnaire('membership', {
					tiers: [
						{ id: 't1', name: 'Gold' },
						{ id: 't2', name: 'Silver' }
					]
				})
			);

			// The summary is a keyboard-reachable tooltip trigger (a real <button>),
			// so it keeps an accessible name.
			expect(screen.getByRole('button', { name: /used by 2 tiers/i })).toBeInTheDocument();
			expect(screen.queryByText(/not assigned/i)).not.toBeInTheDocument();
		});

		it('uses the singular summary for a single tier', () => {
			renderCard(makeQuestionnaire('membership', { tiers: [{ id: 't1', name: 'Gold' }] }));

			expect(screen.getByRole('button', { name: /used by 1 tier/i })).toBeInTheDocument();
		});

		it('says the questionnaire is unused when no tier points at it', () => {
			renderCard(makeQuestionnaire('membership'));

			expect(screen.getByRole('button', { name: /not used by any tier/i })).toBeInTheDocument();
			expect(screen.queryByText(/organization default/i)).not.toBeInTheDocument();
		});

		it('flags the organization-wide default in text, not by colour alone', () => {
			renderCard(makeQuestionnaire('membership', { is_organization_default: true }));

			expect(screen.getByRole('button', { name: /organization default/i })).toBeInTheDocument();
		});

		it('ignores a stray event link left over from a type change', () => {
			renderCard(makeQuestionnaire('membership', { events: [makeEvent('Summer Party', 'e1')] }));

			expect(screen.queryByText(/1 assignment/i)).not.toBeInTheDocument();
			expect(screen.getByRole('button', { name: /not used by any tier/i })).toBeInTheDocument();
		});
	});

	describe.each(['admission', 'feedback', 'generic'] as const)(
		'%s questionnaires (event-assigned)',
		(questionnaire_type) => {
			it('keeps the "Assign to Events" action', () => {
				renderCard(makeQuestionnaire(questionnaire_type));

				expect(screen.getByRole('button', { name: /assign to events/i })).toBeInTheDocument();
			});

			it('shows no membership tier links', () => {
				renderCard(makeQuestionnaire(questionnaire_type));

				expect(
					screen.queryByRole('link', { name: /assign to membership tiers/i })
				).not.toBeInTheDocument();
				expect(
					screen.queryByRole('link', { name: /organization membership settings/i })
				).not.toBeInTheDocument();
			});

			it('keeps the event assignment count', () => {
				renderCard(
					makeQuestionnaire(questionnaire_type, {
						events: [makeEvent('Summer Party', 'e1'), makeEvent('Winter Ball', 'e2')]
					})
				);

				expect(screen.getByRole('button', { name: /2 assignments/i })).toBeInTheDocument();
				expect(screen.queryByText(/used by .* tiers?/i)).not.toBeInTheDocument();
			});

			it('reports "Not assigned" with no events', () => {
				renderCard(makeQuestionnaire(questionnaire_type));

				expect(screen.getByRole('button', { name: /not assigned/i })).toBeInTheDocument();
			});
		}
	);
});
