import {
	eventadminticketsCreateTicketTier,
	organizationadminmembersCreateMembershipTier,
	questionnaireAssignEvent,
	questionnaireCreateOrgQuestionnaire
} from '$lib/api/generated/sdk.gen';
import type {
	MembershipTierCreateSchema,
	OrganizationQuestionnaireCreateSchema,
	TicketTierCreateSchema
} from '$lib/api/generated/types.gen';
import { extractErrorMessage } from '$lib/utils/errors';
import { GRANT_MAX_TICKETS } from './tier-grants';
import { normalizeDecimalInput } from './tier-form-helpers';

/**
 * "Set up a Verein day-membership event" preset (FE #1168).
 *
 * Two halves, kept apart on purpose:
 *  - `buildVereinPlan` is PURE: inputs in, an ordered list of API calls with
 *    their payloads out. The confirm dialog previews exactly this list.
 *  - `runVereinPlan` walks that list sequentially against the generated SDK,
 *    stops at the first failure and reports what exists so far.
 *
 * Every call is an ordinary create endpoint the editor already uses, so what the
 * preset makes is a normal, editable tier / questionnaire afterwards.
 */

/** A value that is only known once an earlier step has run. */
export type Ref = { $ref: 'dayTierId' | 'questionnaireId' };

export type VereinStepId = 'dayTier' | 'questionnaire' | 'assign' | 'publicTier' | 'membersTier';

/** Who may buy the public (day-membership-granting) tier. Never a members-only audience. */
export type PublicAudience = Extract<
	NonNullable<TicketTierCreateSchema['purchasable_by']>,
	'public' | 'non_members'
>;

export type TicketCurrency = NonNullable<TicketTierCreateSchema['currency']>;

export interface VereinPresetInput {
	organizationId: string;
	organizationSlug: string;
	eventId: string;
	currency: TicketCurrency;
	/** Create a new TEMPORARY tier, or reuse one the org already has. */
	dayTier:
		| { mode: 'create'; name: string; description: string }
		| { mode: 'reuse'; id: string; name: string };
	publicTier: { name: string; price: string; audience: PublicAudience };
	membersTier: { name: string; price: string };
	questionnaire: { name: string; question: string; option: string };
	/** Online card payment when the org can take it, otherwise the tiers are created free. */
	paymentMethod: 'online' | 'offline' | 'free';
}

export type DayTierTemplate = MembershipTierCreateSchema;
export type PublicTierTemplate = Omit<TicketTierCreateSchema, 'grants_membership_tier_id'> & {
	grants_membership_tier_id: string | Ref;
};

export type VereinPlanStep =
	| {
			id: 'dayTier';
			op: 'createMembershipTier';
			path: { slug: string };
			body: DayTierTemplate;
	  }
	| {
			id: 'questionnaire';
			op: 'createQuestionnaire';
			path: { organization_id: string };
			body: OrganizationQuestionnaireCreateSchema;
	  }
	| {
			id: 'assign';
			op: 'assignQuestionnaire';
			path: { org_questionnaire_id: Ref; event_id: string };
	  }
	| {
			id: 'publicTier';
			op: 'createTicketTier';
			path: { event_id: string };
			body: PublicTierTemplate;
	  }
	| {
			id: 'membersTier';
			op: 'createTicketTier';
			path: { event_id: string };
			body: TicketTierCreateSchema;
	  };

export interface VereinPlan {
	steps: VereinPlanStep[];
}

/** Normalised price string ("25", "19.5"); '' when it is not a non-negative number. */
export function normalizePrice(raw: string): string {
	const trimmed = raw.trim();
	// Whole or two-decimal amounts only; a stray minus or letter is an error, not a "1".
	if (!/^\d+([.,]\d{1,2})?$/.test(trimmed)) return '';
	return String(Number(normalizeDecimalInput(trimmed)));
}

function pricedTier(
	name: string,
	price: string,
	input: VereinPresetInput
): Pick<
	TicketTierCreateSchema,
	'name' | 'price' | 'price_type' | 'currency' | 'payment_method' | 'visibility'
> {
	const amount = Number(normalizePrice(price) || '0');
	return {
		name: name.trim(),
		price: amount,
		price_type: 'fixed',
		currency: input.currency,
		// A zero price is always "free"; a paid tier uses the method the org can run.
		payment_method: amount > 0 ? input.paymentMethod : 'free',
		visibility: 'public'
	};
}

/**
 * The ordered API calls the preset makes. Constraints are baked in, not left to
 * the user: the granting tier is capped at 1 ticket per person and can only be
 * bought by `public` or `non_members` (a day member counts as a non-member).
 */
export function buildVereinPlan(input: VereinPresetInput): VereinPlan {
	const steps: VereinPlanStep[] = [];

	if (input.dayTier.mode === 'create') {
		steps.push({
			id: 'dayTier',
			op: 'createMembershipTier',
			path: { slug: input.organizationSlug },
			body: {
				name: input.dayTier.name.trim(),
				description: input.dayTier.description.trim() || null,
				kind: 'temporary'
			}
		});
	}

	steps.push({
		id: 'questionnaire',
		op: 'createQuestionnaire',
		path: { organization_id: input.organizationId },
		body: {
			name: input.questionnaire.name.trim(),
			questionnaire_type: 'admission',
			// No review: submitting the answer is all it takes.
			requires_evaluation: false,
			evaluation_mode: 'manual',
			min_score: 0,
			members_exempt: true,
			per_event: true,
			status: 'published',
			multiplechoicequestion_questions: [
				{
					question: input.questionnaire.question.trim(),
					is_mandatory: true,
					allow_multiple_answers: false,
					order: 0,
					options: [{ option: input.questionnaire.option.trim(), is_correct: true, order: 0 }]
				}
			]
		}
	});

	steps.push({
		id: 'assign',
		op: 'assignQuestionnaire',
		path: { org_questionnaire_id: { $ref: 'questionnaireId' }, event_id: input.eventId }
	});

	steps.push({
		id: 'publicTier',
		op: 'createTicketTier',
		path: { event_id: input.eventId },
		body: {
			...pricedTier(input.publicTier.name, input.publicTier.price, input),
			purchasable_by: input.publicTier.audience,
			max_tickets_per_user: Number(GRANT_MAX_TICKETS),
			grants_membership_tier_id:
				input.dayTier.mode === 'reuse' ? input.dayTier.id : { $ref: 'dayTierId' }
		}
	});

	steps.push({
		id: 'membersTier',
		op: 'createTicketTier',
		path: { event_id: input.eventId },
		body: {
			...pricedTier(input.membersTier.name, input.membersTier.price, input),
			purchasable_by: 'members'
		}
	});

	return { steps };
}

/** Why the inputs cannot be turned into a plan yet (keys the dialog maps to messages). */
export type VereinInputIssue =
	| 'dayTierName'
	| 'publicName'
	| 'publicPrice'
	| 'membersName'
	| 'membersPrice'
	| 'questionnaireName'
	| 'question'
	| 'option';

export function validateVereinInput(input: VereinPresetInput): VereinInputIssue[] {
	const issues: VereinInputIssue[] = [];
	if (input.dayTier.mode === 'create' && !input.dayTier.name.trim()) issues.push('dayTierName');
	if (!input.publicTier.name.trim()) issues.push('publicName');
	if (normalizePrice(input.publicTier.price) === '') issues.push('publicPrice');
	if (!input.membersTier.name.trim()) issues.push('membersName');
	if (normalizePrice(input.membersTier.price) === '') issues.push('membersPrice');
	if (!input.questionnaire.name.trim()) issues.push('questionnaireName');
	if (!input.questionnaire.question.trim()) issues.push('question');
	if (!input.questionnaire.option.trim()) issues.push('option');
	return issues;
}

/** Does any step of the plan ask for a paid online ticket? */
export function planChargesOnline(plan: VereinPlan): boolean {
	return plan.steps.some(
		(s) =>
			(s.id === 'publicTier' || s.id === 'membersTier') &&
			s.body.payment_method === 'online' &&
			Number(s.body.price ?? 0) > 0
	);
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export type StepStatus = 'pending' | 'running' | 'done' | 'failed';

export interface StepResult {
	id: VereinStepId;
	status: StepStatus;
	/** Id of the entity the step created (tier, questionnaire). */
	entityId?: string;
	/** Server message when the step failed. */
	error?: string;
}

export interface VereinRunResult {
	steps: StepResult[];
	ok: boolean;
}

interface RunOptions {
	accessToken: string;
	/** Steps finished by an earlier run; they are not repeated (retry-remaining). */
	completed?: Partial<Record<VereinStepId, string>>;
	onProgress?: (steps: StepResult[]) => void;
	/** Seeds ids for a reused day tier. */
	known?: Partial<Record<'dayTierId' | 'questionnaireId', string>>;
}

type Created = { id?: string | null } | undefined;

/**
 * Run the plan one call at a time. Stops at the first failure: later steps stay
 * `pending` and the result says exactly which entities exist. Nothing is rolled
 * back; everything created is an ordinary entity the user can open and edit.
 */
export async function runVereinPlan(
	plan: VereinPlan,
	{ accessToken, completed = {}, onProgress, known = {} }: RunOptions
): Promise<VereinRunResult> {
	const headers = { Authorization: `Bearer ${accessToken}` };
	const ids: Record<'dayTierId' | 'questionnaireId', string | undefined> = {
		dayTierId: known.dayTierId ?? completed.dayTier,
		questionnaireId: known.questionnaireId ?? completed.questionnaire
	};
	const results: StepResult[] = plan.steps.map((s) =>
		completed[s.id] !== undefined
			? { id: s.id, status: 'done', entityId: completed[s.id] }
			: { id: s.id, status: 'pending' }
	);
	const report = () => onProgress?.(results.map((r) => ({ ...r })));
	report();

	for (const [i, step] of plan.steps.entries()) {
		if (results[i].status === 'done') continue;
		results[i] = { id: step.id, status: 'running' };
		report();
		try {
			const created = await runStep(step, ids, headers);
			const createdId = created?.id ?? undefined;
			if (step.id === 'dayTier') ids.dayTierId = createdId;
			if (step.id === 'questionnaire') ids.questionnaireId = createdId;
			results[i] = { id: step.id, status: 'done', entityId: createdId };
			report();
		} catch (err) {
			results[i] = { id: step.id, status: 'failed', error: extractErrorMessage(err) };
			report();
			return { steps: results, ok: false };
		}
	}
	return { steps: results, ok: true };
}

function need(value: string | undefined, name: string): string {
	if (!value) throw new Error(`Missing ${name} from an earlier step`);
	return value;
}

async function runStep(
	step: VereinPlanStep,
	ids: Record<'dayTierId' | 'questionnaireId', string | undefined>,
	headers: { Authorization: string }
): Promise<Created> {
	switch (step.op) {
		case 'createMembershipTier': {
			const res = await organizationadminmembersCreateMembershipTier({
				path: step.path,
				body: step.body,
				headers
			});
			if (res.error) throw res.error;
			return res.data;
		}
		case 'createQuestionnaire': {
			const res = await questionnaireCreateOrgQuestionnaire({
				path: step.path,
				body: step.body,
				headers
			});
			if (res.error) throw res.error;
			return res.data;
		}
		case 'assignQuestionnaire': {
			const res = await questionnaireAssignEvent({
				path: {
					org_questionnaire_id: need(ids.questionnaireId, 'questionnaire'),
					event_id: step.path.event_id
				},
				headers
			});
			if (res.error) throw res.error;
			return undefined;
		}
		case 'createTicketTier': {
			const grant =
				'grants_membership_tier_id' in step.body ? step.body.grants_membership_tier_id : undefined;
			const body: TicketTierCreateSchema =
				grant === undefined
					? (step.body as TicketTierCreateSchema)
					: {
							...step.body,
							grants_membership_tier_id:
								typeof grant === 'string' ? grant : need(ids.dayTierId, 'day-membership tier')
						};
			const res = await eventadminticketsCreateTicketTier({ path: step.path, body, headers });
			if (res.error) throw res.error;
			return res.data;
		}
	}
}
