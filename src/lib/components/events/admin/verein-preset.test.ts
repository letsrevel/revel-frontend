import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	eventadminticketsCreateTicketTier,
	eventadminticketsListTicketTiers,
	organizationadminmembersCreateMembershipTier,
	organizationadminmembersListMembershipTiers,
	questionnaireAssignEvent,
	questionnaireCreateOrgQuestionnaire,
	questionnaireListOrgQuestionnaires
} from '$lib/api/generated/sdk.gen';
import {
	buildVereinPlan,
	normalizePrice,
	planChargesOnline,
	planIsPaid,
	runVereinPlan,
	validateVereinInput,
	type VereinPresetInput
} from './verein-preset';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventadminticketsCreateTicketTier: vi.fn(),
	eventadminticketsListTicketTiers: vi.fn(),
	organizationadminmembersCreateMembershipTier: vi.fn(),
	organizationadminmembersListMembershipTiers: vi.fn(),
	questionnaireAssignEvent: vi.fn(),
	questionnaireCreateOrgQuestionnaire: vi.fn(),
	questionnaireListOrgQuestionnaires: vi.fn()
}));

const baseInput: VereinPresetInput = {
	organizationId: 'org-1',
	organizationSlug: 'verein',
	eventId: 'evt-1',
	currency: 'EUR',
	paymentMethod: 'online',
	dayTier: { mode: 'create', name: 'Day membership', description: 'One event' },
	publicTier: { name: 'Public', price: '25', audience: 'public' },
	membersTier: { name: 'Members', price: '20' },
	questionnaire: { name: 'Statutes', question: 'Accept the statutes?', option: 'Yes' }
};

describe('buildVereinPlan', () => {
	it('lists the five calls in order with their payloads', () => {
		const { steps } = buildVereinPlan(baseInput);
		expect(steps.map((s) => s.id)).toEqual([
			'dayTier',
			'questionnaire',
			'assign',
			'publicTier',
			'membersTier'
		]);
		expect(steps[0]).toMatchObject({
			op: 'createMembershipTier',
			path: { slug: 'verein' },
			body: { name: 'Day membership', kind: 'temporary' }
		});
		expect(steps[1]).toMatchObject({
			op: 'createQuestionnaire',
			path: { organization_id: 'org-1' },
			body: {
				questionnaire_type: 'admission',
				requires_evaluation: false,
				members_exempt: true,
				per_event: true,
				status: 'published'
			}
		});
		expect(steps[2]).toEqual({
			id: 'assign',
			op: 'assignQuestionnaire',
			path: { org_questionnaire_id: { $ref: 'questionnaireId' }, event_id: 'evt-1' }
		});
	});

	it('makes the statutes question mandatory with a single correct option', () => {
		const q = buildVereinPlan(baseInput).steps[1];
		if (q.id !== 'questionnaire') throw new Error('unexpected step');
		expect(q.body.multiplechoicequestion_questions).toEqual([
			expect.objectContaining({
				question: 'Accept the statutes?',
				is_mandatory: true,
				options: [expect.objectContaining({ option: 'Yes', is_correct: true })]
			})
		]);
	});

	it('bakes in the granting-tier constraints', () => {
		const pub = buildVereinPlan(baseInput).steps[3];
		if (pub.id !== 'publicTier') throw new Error('unexpected step');
		expect(pub.body).toMatchObject({
			price: 25,
			currency: 'EUR',
			payment_method: 'online',
			purchasable_by: 'public',
			max_tickets_per_user: 1,
			grants_membership_tier_id: { $ref: 'dayTierId' }
		});
		expect(['members', 'invited_and_members']).not.toContain(pub.body.purchasable_by);
	});

	it('honours the non_members audience choice', () => {
		const pub = buildVereinPlan({
			...baseInput,
			publicTier: { ...baseInput.publicTier, audience: 'non_members' }
		}).steps[3];
		if (pub.id !== 'publicTier') throw new Error('unexpected step');
		expect(pub.body.purchasable_by).toBe('non_members');
		expect(pub.body.max_tickets_per_user).toBe(1);
	});

	it('makes the members tier members-only and does not grant anything', () => {
		const members = buildVereinPlan(baseInput).steps[4];
		if (members.id !== 'membersTier') throw new Error('unexpected step');
		expect(members.body).toMatchObject({ purchasable_by: 'members', price: 20 });
		expect(members.body).not.toHaveProperty('grants_membership_tier_id');
	});

	it('reuses an existing day tier: no create step, the id goes straight into the grant', () => {
		const { steps } = buildVereinPlan({
			...baseInput,
			dayTier: { mode: 'reuse', id: 'day-9', name: 'Existing' }
		});
		expect(steps.map((s) => s.id)).toEqual([
			'questionnaire',
			'assign',
			'publicTier',
			'membersTier'
		]);
		const pub = steps[2];
		if (pub.id !== 'publicTier') throw new Error('unexpected step');
		expect(pub.body.grants_membership_tier_id).toBe('day-9');
	});

	it('creates a zero price as a free tier, whatever the payment method', () => {
		const { steps } = buildVereinPlan({
			...baseInput,
			publicTier: { ...baseInput.publicTier, price: '0' }
		});
		const pub = steps[3];
		if (pub.id !== 'publicTier') throw new Error('unexpected step');
		expect(pub.body.payment_method).toBe('free');
		expect(planChargesOnline(buildVereinPlan(baseInput))).toBe(true);
		expect(
			planChargesOnline(
				buildVereinPlan({
					...baseInput,
					publicTier: { ...baseInput.publicTier, price: '0' },
					membersTier: { name: 'M', price: '0' }
				})
			)
		).toBe(false);
	});
});

describe('normalizePrice / validateVereinInput', () => {
	it('accepts comma decimals and rejects negatives and garbage', () => {
		expect(normalizePrice('19,5')).toBe('19.5');
		expect(normalizePrice('-1')).toBe('');
		expect(normalizePrice('abc')).toBe('');
		expect(normalizePrice('')).toBe('');
	});

	it('reports every missing field', () => {
		expect(validateVereinInput(baseInput)).toEqual([]);
		const issues = validateVereinInput({
			...baseInput,
			dayTier: { mode: 'create', name: ' ', description: '' },
			publicTier: { name: '', price: 'x', audience: 'public' },
			membersTier: { name: '', price: '' },
			questionnaire: { name: '', question: '', option: '' }
		});
		expect(issues).toEqual([
			'dayTierName',
			'publicName',
			'publicPrice',
			'membersName',
			'membersPrice',
			'questionnaireName',
			'question',
			'option'
		]);
	});
});

describe('runVereinPlan', () => {
	beforeEach(() => vi.clearAllMocks());

	const ok = <T>(data: T) => ({ data, error: undefined });

	it('runs the steps in order and threads the created ids through', async () => {
		vi.mocked(organizationadminmembersCreateMembershipTier).mockResolvedValue(
			ok({ id: 'day-1' }) as never
		);
		vi.mocked(questionnaireCreateOrgQuestionnaire).mockResolvedValue(ok({ id: 'q-1' }) as never);
		vi.mocked(questionnaireAssignEvent).mockResolvedValue(ok({}) as never);
		vi.mocked(eventadminticketsCreateTicketTier).mockResolvedValue(ok({ id: 't' }) as never);

		const result = await runVereinPlan(buildVereinPlan(baseInput), { accessToken: 'tok' });

		expect(result.ok).toBe(true);
		expect(vi.mocked(questionnaireAssignEvent).mock.calls[0][0]).toMatchObject({
			path: { org_questionnaire_id: 'q-1', event_id: 'evt-1' }
		});
		const tierCalls = vi.mocked(eventadminticketsCreateTicketTier).mock.calls;
		expect(tierCalls).toHaveLength(2);
		expect(tierCalls[0][0].body).toMatchObject({
			grants_membership_tier_id: 'day-1',
			max_tickets_per_user: 1
		});
		expect(tierCalls[0][0].headers).toEqual({ Authorization: 'Bearer tok' });
	});

	it('stops at the first failure and keeps what was created', async () => {
		vi.mocked(organizationadminmembersCreateMembershipTier).mockResolvedValue(
			ok({ id: 'day-1' }) as never
		);
		vi.mocked(questionnaireCreateOrgQuestionnaire).mockResolvedValue({
			data: undefined,
			error: { detail: 'Nope' }
		} as never);

		const result = await runVereinPlan(buildVereinPlan(baseInput), { accessToken: 'tok' });

		expect(result.ok).toBe(false);
		expect(result.steps.map((s) => s.status)).toEqual([
			'done',
			'failed',
			'pending',
			'pending',
			'pending'
		]);
		expect(result.steps[1].error).toBe('Nope');
		expect(questionnaireAssignEvent).not.toHaveBeenCalled();
		expect(eventadminticketsCreateTicketTier).not.toHaveBeenCalled();
	});

	it('resumes without repeating completed steps', async () => {
		vi.mocked(questionnaireAssignEvent).mockResolvedValue(ok({}) as never);
		vi.mocked(eventadminticketsCreateTicketTier).mockResolvedValue(ok({ id: 't' }) as never);

		const result = await runVereinPlan(buildVereinPlan(baseInput), {
			accessToken: 'tok',
			completed: { dayTier: 'day-1', questionnaire: 'q-1' }
		});

		expect(result.ok).toBe(true);
		expect(organizationadminmembersCreateMembershipTier).not.toHaveBeenCalled();
		expect(questionnaireCreateOrgQuestionnaire).not.toHaveBeenCalled();
		expect(vi.mocked(questionnaireAssignEvent).mock.calls[0][0]).toMatchObject({
			path: { org_questionnaire_id: 'q-1' }
		});
		expect(vi.mocked(eventadminticketsCreateTicketTier).mock.calls[0][0].body).toMatchObject({
			grants_membership_tier_id: 'day-1'
		});
	});

	it('reports a thrown network error as a failed step', async () => {
		vi.mocked(organizationadminmembersCreateMembershipTier).mockRejectedValue(new Error('offline'));
		const result = await runVereinPlan(buildVereinPlan(baseInput), { accessToken: 'tok' });
		expect(result.steps[0].status).toBe('failed');
		expect(result.steps[0].error).toBeTruthy();
	});

	it('flags a network failure as ambiguous and a 4xx as definite', async () => {
		vi.mocked(organizationadminmembersCreateMembershipTier).mockRejectedValue(new Error('offline'));
		const net = await runVereinPlan(buildVereinPlan(baseInput), { accessToken: 'tok' });
		expect(net.steps[0].ambiguous).toBe(true);

		vi.mocked(organizationadminmembersCreateMembershipTier).mockResolvedValue({
			data: undefined,
			error: { detail: 'Bad' },
			response: { status: 422 }
		} as never);
		const client = await runVereinPlan(buildVereinPlan(baseInput), { accessToken: 'tok' });
		expect(client.steps[0].ambiguous).toBe(false);

		vi.mocked(organizationadminmembersCreateMembershipTier).mockResolvedValue({
			data: undefined,
			error: { detail: 'Oops' },
			response: { status: 502 }
		} as never);
		const server = await runVereinPlan(buildVereinPlan(baseInput), { accessToken: 'tok' });
		expect(server.steps[0].ambiguous).toBe(true);
	});
});

const ok = <T>(data: T) => ({ data, error: undefined });

describe('runVereinPlan reconciliation', () => {
	beforeEach(() => vi.clearAllMocks());

	it('adopts an entity found by name instead of re-creating it', async () => {
		vi.mocked(organizationadminmembersListMembershipTiers).mockResolvedValue(
			ok([{ id: 'day-found', name: 'Day membership' }]) as never
		);
		vi.mocked(questionnaireCreateOrgQuestionnaire).mockResolvedValue(ok({ id: 'q-1' }) as never);
		vi.mocked(questionnaireAssignEvent).mockResolvedValue(ok({}) as never);
		vi.mocked(eventadminticketsCreateTicketTier).mockResolvedValue(ok({ id: 't' }) as never);

		const result = await runVereinPlan(buildVereinPlan(baseInput), {
			accessToken: 'tok',
			reconcile: { dayTier: true }
		});

		expect(result.ok).toBe(true);
		expect(organizationadminmembersCreateMembershipTier).not.toHaveBeenCalled();
		expect(result.steps[0]).toMatchObject({ status: 'done', entityId: 'day-found' });
		expect(vi.mocked(eventadminticketsCreateTicketTier).mock.calls[0][0].body).toMatchObject({
			grants_membership_tier_id: 'day-found'
		});
	});

	it('creates the entity when the lookup finds nothing', async () => {
		vi.mocked(organizationadminmembersListMembershipTiers).mockResolvedValue(
			ok([{ id: 'other', name: 'Something else' }]) as never
		);
		vi.mocked(organizationadminmembersCreateMembershipTier).mockResolvedValue(
			ok({ id: 'day-new' }) as never
		);
		vi.mocked(questionnaireCreateOrgQuestionnaire).mockResolvedValue(ok({ id: 'q-1' }) as never);
		vi.mocked(questionnaireAssignEvent).mockResolvedValue(ok({}) as never);
		vi.mocked(eventadminticketsCreateTicketTier).mockResolvedValue(ok({ id: 't' }) as never);

		const result = await runVereinPlan(buildVereinPlan(baseInput), {
			accessToken: 'tok',
			reconcile: { dayTier: true }
		});

		expect(result.ok).toBe(true);
		expect(organizationadminmembersCreateMembershipTier).toHaveBeenCalledTimes(1);
		expect(result.steps[0].entityId).toBe('day-new');
	});

	it('does not look anything up for a step that is not flagged', async () => {
		vi.mocked(organizationadminmembersCreateMembershipTier).mockResolvedValue(
			ok({ id: 'day-1' }) as never
		);
		vi.mocked(questionnaireCreateOrgQuestionnaire).mockResolvedValue({
			data: undefined,
			error: { detail: 'x' }
		} as never);
		await runVereinPlan(buildVereinPlan(baseInput), { accessToken: 'tok' });
		expect(organizationadminmembersListMembershipTiers).not.toHaveBeenCalled();
		expect(questionnaireListOrgQuestionnaires).not.toHaveBeenCalled();
	});

	it('matches questionnaires by name, then checks the event assignment', async () => {
		vi.mocked(questionnaireListOrgQuestionnaires)
			.mockResolvedValueOnce(
				ok({ results: [{ id: 'q-found', questionnaire: { name: 'Statutes' } }] }) as never
			)
			.mockResolvedValueOnce(
				ok({ results: [{ id: 'q-found', events: [{ id: 'evt-1' }] }] }) as never
			);
		vi.mocked(eventadminticketsCreateTicketTier).mockResolvedValue(ok({ id: 't' }) as never);

		const result = await runVereinPlan(buildVereinPlan(baseInput), {
			accessToken: 'tok',
			completed: { dayTier: 'day-1' },
			reconcile: { questionnaire: true, assign: true }
		});

		expect(result.ok).toBe(true);
		expect(questionnaireCreateOrgQuestionnaire).not.toHaveBeenCalled();
		expect(questionnaireAssignEvent).not.toHaveBeenCalled();
		expect(result.steps[1]).toMatchObject({ status: 'done', entityId: 'q-found' });
	});

	it('adopts a ticket tier already on the event', async () => {
		vi.mocked(eventadminticketsListTicketTiers).mockResolvedValue(
			ok({ results: [{ id: 'tier-pub', name: 'Public' }] }) as never
		);
		vi.mocked(eventadminticketsCreateTicketTier).mockResolvedValue(ok({ id: 'tier-mem' }) as never);
		const result = await runVereinPlan(buildVereinPlan(baseInput), {
			accessToken: 'tok',
			completed: { dayTier: 'd', questionnaire: 'q', assign: 'q' },
			reconcile: { publicTier: true }
		});
		expect(result.steps[3]).toMatchObject({ status: 'done', entityId: 'tier-pub' });
		expect(eventadminticketsCreateTicketTier).toHaveBeenCalledTimes(1);
	});

	it('fails the step as ambiguous when the lookup itself fails', async () => {
		vi.mocked(organizationadminmembersListMembershipTiers).mockRejectedValue(new Error('offline'));
		const result = await runVereinPlan(buildVereinPlan(baseInput), {
			accessToken: 'tok',
			reconcile: { dayTier: true }
		});
		expect(result.steps[0]).toMatchObject({ status: 'failed', ambiguous: true });
		expect(organizationadminmembersCreateMembershipTier).not.toHaveBeenCalled();
	});
});

describe('planIsPaid', () => {
	it('is true with a price above zero, whatever the payment method', () => {
		expect(planIsPaid(buildVereinPlan(baseInput))).toBe(true);
		expect(planIsPaid(buildVereinPlan({ ...baseInput, paymentMethod: 'free' }))).toBe(true);
	});
	it('is false when both tickets are free', () => {
		const free = {
			...baseInput,
			publicTier: { ...baseInput.publicTier, price: '0' },
			membersTier: { ...baseInput.membersTier, price: '0' }
		};
		expect(planIsPaid(buildVereinPlan(free))).toBe(false);
	});
});
