import crypto from 'node:crypto';
import { API_URL, ApiClient, ApiError, fetchWithRetry } from './api';
import { extractLink, waitForEmail } from './mailpit';
import { PERSONAS, type PersonaName } from './personas';

/**
 * Arrange-data factories.
 *
 * Mutating journey specs API-create their own uniquely-named data so parallel
 * workers and repeated runs never collide (the bootstrap seed is reset only via
 * `make reset-events && make bootstrap`, never by tests).
 *
 * Factories grow here as the journey suites need them — each a small wrapper
 * over the backend API with a uniqueName()-based name.
 */

const RUN_ID = crypto.randomBytes(3).toString('hex');

/** `E2E <label> <runid>-<seq>` — unique across workers, greppable in the DB. */
let sequence = 0;
export function uniqueName(label: string): string {
	sequence += 1;
	return `E2E ${label} ${RUN_ID}-${sequence}`;
}

/** Unique mailbox for flows that assert on delivered email (Mailpit search). */
export function uniqueEmail(label: string): string {
	sequence += 1;
	return `e2e+${label.toLowerCase()}-${RUN_ID}-${sequence}@example.com`;
}

export interface ThrowawayUser {
	email: string;
	password: string;
	firstName: string;
	lastName: string;
}

/**
 * Register a fresh user via the API and complete email verification through
 * Mailpit — for flows that consume per-user quotas (ticket limits,
 * questionnaire attempts) or destroy their account, where reusing a seeded
 * persona would make the spec non-re-runnable.
 */
export async function createVerifiedUser(label: string): Promise<ThrowawayUser> {
	const email = uniqueEmail(label);
	const password = 'E2e-test-Pass!123';
	const firstName = 'E2E';
	const lastName = label;

	const register = await fetchWithRetry(`${API_URL}/api/account/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			email,
			password1: password,
			password2: password,
			first_name: firstName,
			last_name: lastName,
			accept_toc_and_privacy: true
		})
	});
	if (!register.ok) {
		throw new ApiError(register.status, 'POST', '/api/account/register', await register.text());
	}

	// Complete verification with the token from the emailed link.
	const message = await waitForEmail({ to: email });
	const link = extractLink(message, /token=/);
	const token = new URL(link).searchParams.get('token');
	if (!token) {
		throw new Error(`Verification link has no token: ${link}`);
	}
	const verify = await fetchWithRetry(`${API_URL}/api/account/verify`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ token })
	});
	if (!verify.ok) {
		throw new ApiError(verify.status, 'POST', '/api/account/verify', await verify.text());
	}

	return { email, password, firstName, lastName };
}

export interface CreatedEvent {
	id: string;
	slug: string;
	orgSlug: string;
	/** Public detail path, e.g. /events/<org>/<slug>. */
	path: string;
	name: string;
	/** Set when the event was created with `freeTier: true`. */
	freeTierId?: string;
}

/**
 * API-create an OPEN, public event (owned by a seeded org owner — or, when
 * `owner` is a ThrowawayUser, by that user on their own org), optionally
 * with an immediately-purchasable free tier. Specs use this instead of relying
 * on seeded events whose sales windows / capacity drift with the clock.
 */
export async function createTicketedEvent(
	options: {
		owner?: PersonaName | ThrowawayUser;
		orgSlug?: string;
		freeTier?: boolean;
		event?: Record<string, unknown>;
	} = {}
): Promise<CreatedEvent> {
	const { owner = 'owner', orgSlug = 'revel-events-collective', freeTier = true } = options;
	const credentials = typeof owner === 'string' ? PERSONAS[owner] : owner;
	const api = await ApiClient.login(credentials.email, credentials.password);

	const name = uniqueName('Event');
	const dayMs = 24 * 60 * 60 * 1000;
	const start = new Date(Date.now() + 7 * dayMs);
	const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);

	const event = await api.post<{ id: string; slug: string }>(
		`/api/organization-admin/${orgSlug}/create-event`,
		{
			name,
			start: start.toISOString(),
			end: end.toISOString(),
			status: 'open',
			event_type: 'public',
			visibility: 'public',
			requires_ticket: true,
			max_attendees: 500,
			...options.event
		}
	);

	let freeTierId: string | undefined;
	if (freeTier) {
		const tier = await api.post<{ id: string }>(`/api/event-admin/${event.id}/ticket-tier`, {
			name: 'Free Entry',
			payment_method: 'free',
			price: '0.00',
			price_type: 'fixed',
			total_quantity: 200,
			sales_start_at: new Date(Date.now() - dayMs).toISOString(),
			sales_end_at: end.toISOString()
		});
		freeTierId = tier.id;
	}

	return {
		id: event.id,
		slug: event.slug,
		orgSlug,
		path: `/events/${orgSlug}/${event.slug}`,
		name,
		freeTierId
	};
}

/**
 * API-create a ticket tier on an event owned by a seeded persona. Sales open
 * immediately. Pass payment_method/price/etc. in `tier` — defaults make a
 * fixed-price ONLINE (Stripe) tier, which needs the org to be
 * Stripe-connected (Org Alpha is; see tests/e2e/README.md).
 */
export async function createTicketTier(
	eventId: string,
	tier: Record<string, unknown> = {},
	owner: PersonaName | ThrowawayUser = 'owner'
): Promise<{ id: string; name: string }> {
	const credentials = typeof owner === 'string' ? PERSONAS[owner] : owner;
	const api = await ApiClient.login(credentials.email, credentials.password);
	const dayMs = 24 * 60 * 60 * 1000;
	const name = (tier.name as string) ?? 'Online Tier';
	const created = await api.post<{ id: string }>(`/api/event-admin/${eventId}/ticket-tier`, {
		name,
		payment_method: 'online',
		price: '10.00',
		price_type: 'fixed',
		total_quantity: 100,
		sales_start_at: new Date(Date.now() - dayMs).toISOString(),
		sales_end_at: new Date(Date.now() + 30 * dayMs).toISOString(),
		...tier
	});
	return { id: created.id, name };
}

export interface CreatedOrg {
	id: string;
	slug: string;
	name: string;
	/** The throwaway user who owns the org (backend allows ONE org per owner). */
	owner: ThrowawayUser;
	/** The "General membership" tier every new org gets from a post-save signal. */
	defaultTierId: string;
}

/**
 * Register a fresh verified user and have them create an organization — the
 * backend allows one org per owner, so seeded personas (who already own orgs)
 * can never be the owner here. Every new org automatically gets a
 * "General membership" tier; its id is returned for approve-with-tier flows.
 */
export async function createOrganization(
	options: {
		acceptMembershipRequests?: boolean;
		contactEmail?: string;
		/** New orgs default to PRIVATE visibility, which also hides their public
		 * series pages (series visibility derives from the org's) — set this for
		 * specs that browse the org's public surfaces as an outsider. */
		publicVisibility?: boolean;
	} = {}
): Promise<CreatedOrg> {
	const owner = await createVerifiedUser('OrgOwner');
	const api = await ApiClient.login(owner.email, owner.password);
	const name = uniqueName('Org');
	// Defaults to the owner's email, which the backend treats as ALREADY
	// VERIFIED (it matches a verified account). Pass a different contactEmail
	// to get an org whose contact email is unverified.
	const org = await api.post<{ id: string; slug: string }>('/api/organizations/', {
		name,
		contact_email: options.contactEmail ?? owner.email
	});

	if (options.acceptMembershipRequests || options.publicVisibility) {
		await api.put(`/api/organization-admin/${org.slug}`, {
			visibility: 'public',
			accept_membership_requests: options.acceptMembershipRequests ?? false
		});
	}

	// Plain array (not paginated).
	const tiers = await api.get<Array<{ id: string; name: string }>>(
		`/api/organization-admin/${org.slug}/membership-tiers`
	);
	const defaultTier = tiers.find((t) => t.name === 'General membership');
	if (!defaultTier) {
		throw new Error(`New org ${org.slug} is missing its default membership tier`);
	}

	return { id: org.id, slug: org.slug, name, owner, defaultTierId: defaultTier.id };
}

/** API-create a membership-granting invitation token on a throwaway-owned org. */
export async function createOrgToken(
	owner: ThrowawayUser,
	orgSlug: string,
	tierId: string,
	options: { name?: string; maxUses?: number } = {}
): Promise<{ id: string }> {
	const api = await ApiClient.login(owner.email, owner.password);
	return api.post<{ id: string }>(`/api/organization-admin/${orgSlug}/tokens`, {
		name: options.name ?? uniqueName('Token'),
		max_uses: options.maxUses ?? 5,
		grants_membership: true,
		membership_tier_id: tierId
	});
}

/** API-create an invitation-granting token on an event owned by a seeded persona. */
export async function createEventToken(
	eventId: string,
	options: { name?: string; maxUses?: number; owner?: PersonaName } = {}
): Promise<{ id: string }> {
	const persona = PERSONAS[options.owner ?? 'owner'];
	const api = await ApiClient.login(persona.email, persona.password);
	return api.post<{ id: string }>(`/api/event-admin/${eventId}/tokens`, {
		name: options.name ?? uniqueName('EventToken'),
		max_uses: options.maxUses ?? 5,
		grants_invitation: true
	});
}

/**
 * API-create invitations on an event owned by a seeded persona (or a
 * ThrowawayUser owner). The backend branches per email: a registered address
 * gets a direct EventInvitation (which fires the INVITATION_RECEIVED in-app
 * notification via a post_save signal), an unregistered one gets a
 * PendingEventInvitation that auto-converts when that email registers.
 * Waiver flags (`waives_questionnaire`, `waives_purchase`, …) and
 * `custom_message` go in `options.invitation`.
 */
export async function inviteToEvent(
	eventId: string,
	emails: string[],
	options: { owner?: PersonaName | ThrowawayUser; invitation?: Record<string, unknown> } = {}
): Promise<void> {
	const { owner = 'owner' } = options;
	const credentials = typeof owner === 'string' ? PERSONAS[owner] : owner;
	const api = await ApiClient.login(credentials.email, credentials.password);
	await api.post(`/api/event-admin/${eventId}/invitations`, {
		emails,
		...options.invitation
	});
}

/**
 * Create a PUBLISHED admission questionnaire (manual evaluation, one mandatory
 * free-text question) on the event's org and assign it to the event — from
 * then on the event's eligibility gate answers `next_step:
 * "complete_questionnaire"` for users without a submission. Only ever attach
 * to events the spec created itself, NEVER to seeded events (it would gate
 * every other spec touching them).
 */
export async function attachAdmissionQuestionnaire(
	event: CreatedEvent,
	owner: PersonaName | ThrowawayUser = 'owner'
): Promise<{ id: string; name: string }> {
	const credentials = typeof owner === 'string' ? PERSONAS[owner] : owner;
	const api = await ApiClient.login(credentials.email, credentials.password);

	const org = await api.get<{ id: string }>(`/api/organizations/${event.orgSlug}`);
	const name = uniqueName('Questionnaire');
	const questionnaire = await api.post<{ id: string }>(
		`/api/questionnaires/${org.id}/create-questionnaire`,
		{
			name,
			min_score: 0,
			evaluation_mode: 'manual',
			status: 'published',
			freetextquestion_questions: [{ question: 'Why do you want to attend?', is_mandatory: true }]
		}
	);
	await api.post(`/api/questionnaires/${questionnaire.id}/events/${event.id}`);
	return { id: questionnaire.id, name };
}

/**
 * Create a PUBLISHED questionnaire with a caller-supplied question payload on
 * the event's org and assign it to the event — the generalized sibling of
 * attachAdmissionQuestionnaire for specs that need conditional questions,
 * automatic evaluation, or attempt/cooldown settings. Same isolation rule:
 * only ever attach to events the spec created itself — and prefer a
 * THROWAWAY org: questionnaires accumulate on the org's admin index, and
 * crowding Org Alpha's pushes the seeded wine-tasting card (which
 * manual-review navigates by) off the page.
 */
export async function attachQuestionnaire(
	event: CreatedEvent,
	questionnaire: Record<string, unknown>,
	owner: PersonaName | ThrowawayUser = 'owner'
): Promise<{ id: string; name: string }> {
	const credentials = typeof owner === 'string' ? PERSONAS[owner] : owner;
	const api = await ApiClient.login(credentials.email, credentials.password);

	const org = await api.get<{ id: string }>(`/api/organizations/${event.orgSlug}`);
	const name = (questionnaire.name as string) ?? uniqueName('Questionnaire');
	const created = await api.post<{ id: string }>(
		`/api/questionnaires/${org.id}/create-questionnaire`,
		{
			name,
			min_score: 0,
			evaluation_mode: 'manual',
			status: 'published',
			...questionnaire
		}
	);
	await api.post(`/api/questionnaires/${created.id}/events/${event.id}`);
	return { id: created.id, name };
}

/** Look up a throwaway user's own id — admin on-behalf endpoints want a user_id. */
export async function getUserId(user: ThrowawayUser): Promise<string> {
	const api = await ApiClient.login(user.email, user.password);
	const me = await api.get<{ id: string }>('/api/account/me');
	return me.id;
}

/**
 * Admin-create an RSVP on behalf of a registered user — the ARRANGE step for
 * specs that need attendance state the public API refuses to create (e.g. a
 * YES RSVP on an already-finished event for the feedback-questionnaire gate).
 */
export async function rsvpOnBehalf(
	owner: PersonaName | ThrowawayUser,
	eventId: string,
	userId: string,
	status: 'yes' | 'no' | 'maybe'
): Promise<void> {
	const credentials = typeof owner === 'string' ? PERSONAS[owner] : owner;
	const api = await ApiClient.login(credentials.email, credentials.password);
	await api.post(`/api/event-admin/${eventId}/rsvps`, { user_id: userId, status });
}

export interface CreatedSeries {
	id: string;
	slug: string;
	orgSlug: string;
	name: string;
	/** Public series path, e.g. /events/<org>/series/<slug>. */
	path: string;
}

/**
 * API-create a plain (non-recurring, grouping-only) event series. Events join
 * it by passing `event_series_id` to createTicketedEvent. Series accumulate on
 * the org profile with no cleanup — prefer a THROWAWAY org unless the spec
 * needs Org Alpha's Stripe connection.
 */
export async function createEventSeries(
	owner: PersonaName | ThrowawayUser,
	orgSlug: string
): Promise<CreatedSeries> {
	const credentials = typeof owner === 'string' ? PERSONAS[owner] : owner;
	const api = await ApiClient.login(credentials.email, credentials.password);
	const name = uniqueName('Series');
	const series = await api.post<{ id: string; slug: string }>(
		`/api/organization-admin/${orgSlug}/create-event-series`,
		{ name }
	);
	return {
		id: series.id,
		slug: series.slug,
		orgSlug,
		name,
		path: `/events/${orgSlug}/series/${series.slug}`
	};
}

/**
 * API-create a season pass on an event series. `tier_links` maps each covered
 * event to the backing tier the materialized tickets will use. Coverage rules
 * (backend validate_events_coverable): covered events must be OPEN, ticketed,
 * in a NON-recurring series, not questionnaire-gated; backing tiers must not
 * be seated or pay-what-you-can; the quote is only purchasable while at least
 * 2 covered events are still upcoming.
 */
export async function createSeriesPass(
	owner: PersonaName | ThrowawayUser,
	seriesId: string,
	pass: Record<string, unknown> & { tier_links: Array<{ event_id: string; tier_id: string }> }
): Promise<{ id: string; name: string }> {
	const credentials = typeof owner === 'string' ? PERSONAS[owner] : owner;
	const api = await ApiClient.login(credentials.email, credentials.password);
	const name = (pass.name as string) ?? uniqueName('Pass');
	const created = await api.post<{ id: string }>(`/api/event-series-admin/${seriesId}/passes/`, {
		name,
		price: '10.00',
		pro_rata_discount: '0.00',
		currency: 'EUR',
		payment_method: 'free',
		...pass
	});
	return { id: created.id, name };
}

/**
 * Create a PUBLISHED questionnaire on the org and attach it at the EVENT
 * SERIES level — passing once then satisfies the gate for every event in the
 * series (as long as the wrapper keeps per_event=false, the default). Same
 * isolation rule as attachQuestionnaire: THROWAWAY orgs only.
 */
export async function attachQuestionnaireToSeries(
	series: CreatedSeries,
	questionnaire: Record<string, unknown>,
	owner: ThrowawayUser
): Promise<{ id: string; name: string }> {
	const api = await ApiClient.login(owner.email, owner.password);
	const org = await api.get<{ id: string }>(`/api/organizations/${series.orgSlug}`);
	const name = (questionnaire.name as string) ?? uniqueName('Questionnaire');
	const created = await api.post<{ id: string }>(
		`/api/questionnaires/${org.id}/create-questionnaire`,
		{
			name,
			min_score: 0,
			evaluation_mode: 'manual',
			status: 'published',
			...questionnaire
		}
	);
	await api.post(`/api/questionnaires/${created.id}/event-series/${series.id}`);
	return { id: created.id, name };
}

export interface GuestIdentity {
	email: string;
	firstName: string;
	lastName: string;
}

/**
 * Complete a full guest RSVP (no account) via the public API: submit the
 * guest form payload, then confirm through the emailed token — only the
 * confirmation actually creates the RSVP row (and its guest RevelUser). The
 * event must have `can_attend_without_login: true`. ARRANGE step for the
 * guest→account upgrade journey; the guest UI journey itself is j07.
 */
export async function createGuestRsvp(eventId: string, label = 'Guest'): Promise<GuestIdentity> {
	const email = uniqueEmail(label);
	const firstName = 'E2E';
	const lastName = label;

	const rsvp = await fetchWithRetry(`${API_URL}/api/events/${eventId}/rsvp/yes/public`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, first_name: firstName, last_name: lastName })
	});
	if (!rsvp.ok) {
		throw new ApiError(
			rsvp.status,
			'POST',
			`/api/events/${eventId}/rsvp/yes/public`,
			await rsvp.text()
		);
	}

	const message = await waitForEmail({ to: email, subject: 'Confirm your RSVP' });
	const link = extractLink(message, /confirm-action\?token=/);
	const token = new URL(link).searchParams.get('token');
	if (!token) {
		throw new Error(`Guest confirmation link has no token: ${link}`);
	}
	const confirm = await fetchWithRetry(`${API_URL}/api/events/guest-actions/confirm`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ token })
	});
	if (!confirm.ok) {
		throw new ApiError(
			confirm.status,
			'POST',
			'/api/events/guest-actions/confirm',
			await confirm.text()
		);
	}

	return { email, firstName, lastName };
}

/** Add a membership tier to a throwaway-owned org. */
export async function createMembershipTier(
	owner: ThrowawayUser,
	orgSlug: string,
	name: string
): Promise<{ id: string }> {
	const api = await ApiClient.login(owner.email, owner.password);
	return api.post<{ id: string }>(`/api/organization-admin/${orgSlug}/membership-tiers`, { name });
}

/**
 * API-create a subscription plan on a membership tier of a throwaway-owned
 * org (defaults: €15.00 monthly). ARRANGE step for the subscription-lifecycle
 * journey — plan AUTHORING through the UI is j23 plans-admin.
 */
export async function createSubscriptionPlan(
	owner: ThrowawayUser,
	orgSlug: string,
	tierId: string,
	plan: Record<string, unknown> = {}
): Promise<{ id: string; name: string }> {
	const api = await ApiClient.login(owner.email, owner.password);
	const name = (plan.name as string) ?? uniqueName('Plan');
	const created = await api.post<{ id: string }>(
		`/api/organization-admin/${orgSlug}/tiers/${tierId}/plans`,
		{ name, price: '15.00', currency: 'EUR', ...plan }
	);
	return { id: created.id, name };
}

/**
 * Have a throwaway user request membership of an org (the org must have been
 * created with `acceptMembershipRequests: true`). Returns the request id the
 * org admin sees.
 */
export async function requestMembership(
	user: ThrowawayUser,
	orgSlug: string,
	message?: string
): Promise<{ id: string }> {
	const api = await ApiClient.login(user.email, user.password);
	return api.post<{ id: string }>(
		`/api/organizations/${orgSlug}/membership-requests`,
		message ? { message } : {}
	);
}

/**
 * Approve a pending membership request as the org owner — ARRANGE step for
 * specs that need an existing MEMBER (staff promotion, status changes).
 */
export async function approveMembershipRequest(
	owner: ThrowawayUser,
	orgSlug: string,
	requestId: string,
	tierId: string
): Promise<void> {
	const api = await ApiClient.login(owner.email, owner.password);
	await api.post(`/api/organization-admin/${orgSlug}/membership-requests/${requestId}/approve`, {
		tier_id: tierId
	});
}

/**
 * Look up an org member's user id via the org-admin members list (the search
 * param matches email). Factory emails contain `+`, so the query is always
 * URI-encoded.
 */
async function findMemberUserId(api: ApiClient, orgSlug: string, email: string): Promise<string> {
	const page = await api.get<{ results: Array<{ user: { id: string; email: string } }> }>(
		`/api/organization-admin/${orgSlug}/members?search=${encodeURIComponent(email)}`
	);
	const member = page.results.find((m) => m.user.email === email) ?? page.results[0];
	if (!member) {
		throw new Error(`No member matching ${email} in org ${orgSlug}`);
	}
	return member.user.id;
}

/** Set an existing member's status (active/paused/cancelled/banned) as the org owner. */
export async function setMemberStatus(
	owner: ThrowawayUser,
	orgSlug: string,
	memberEmail: string,
	status: 'active' | 'paused' | 'cancelled' | 'banned'
): Promise<void> {
	const api = await ApiClient.login(owner.email, owner.password);
	const userId = await findMemberUserId(api, orgSlug, memberEmail);
	await api.put(`/api/organization-admin/${orgSlug}/members/${userId}`, { status });
}

/**
 * Promote an existing MEMBER to staff, optionally with a narrow permission
 * map (unset keys keep the backend defaults — everything false except
 * view_organization_details). Returns the promoted user's id for follow-up
 * permission updates.
 */
export async function addStaff(
	owner: ThrowawayUser,
	orgSlug: string,
	memberEmail: string,
	permissions?: Record<string, boolean>
): Promise<string> {
	const api = await ApiClient.login(owner.email, owner.password);
	const userId = await findMemberUserId(api, orgSlug, memberEmail);
	await api.post(
		`/api/organization-admin/${orgSlug}/staff/${userId}`,
		permissions ? { default: permissions, event_overrides: {} } : undefined
	);
	return userId;
}

/** Replace a staff member's org-wide permission map (owner-only endpoint). */
export async function setStaffPermissions(
	owner: ThrowawayUser,
	orgSlug: string,
	userId: string,
	permissions: Record<string, boolean>
): Promise<void> {
	const api = await ApiClient.login(owner.email, owner.password);
	await api.put(`/api/organization-admin/${orgSlug}/staff/${userId}/permissions`, {
		default: permissions,
		event_overrides: {}
	});
}

/**
 * API-create a blacklist entry on a throwaway-owned org. Passing the email of
 * a REGISTERED user auto-links the entry to that account, which immediately
 * applies the consequences (staff stripped, membership set to BANNED, event
 * access blocked) via the backend's post_save signal.
 */
export async function addToBlacklist(
	owner: ThrowawayUser,
	orgSlug: string,
	entry: Record<string, unknown>
): Promise<{ id: string }> {
	const api = await ApiClient.login(owner.email, owner.password);
	return api.post<{ id: string }>(`/api/organization-admin/${orgSlug}/blacklist`, entry);
}

export interface CreatedPoll {
	id: string;
	orgSlug: string;
	/** Voter share path, e.g. /org/<org>/polls/<id>. */
	path: string;
	name: string;
	/** The single MC question's id + option ids (creation order) for API votes. */
	questionId: string;
	optionIds: string[];
}

/**
 * API-create a poll with one two-option MC question ("Yes"/"No"), optionally
 * opening it for votes. Polls are NEVER seeded — every poll spec arranges its
 * own. Defaults mirror the backend/create-form defaults: members-only vote,
 * staff-only results, result timing "never", fully anonymous, no vote changes
 * — override per-scenario via `poll` (e.g. `allow_vote_changes`,
 * `result_timing`, `result_visibility`).
 */
export async function createPoll(
	options: {
		owner?: PersonaName | ThrowawayUser;
		orgSlug?: string;
		open?: boolean;
		poll?: Record<string, unknown>;
	} = {}
): Promise<CreatedPoll> {
	const { owner = 'owner', orgSlug = 'revel-events-collective', open = true } = options;
	const credentials = typeof owner === 'string' ? PERSONAS[owner] : owner;
	const api = await ApiClient.login(credentials.email, credentials.password);

	const org = await api.get<{ id: string }>(`/api/organizations/${orgSlug}`);
	const name = uniqueName('Poll');
	const poll = await api.post<{
		id: string;
		questionnaire: {
			multiple_choice_questions: Array<{ id: string; options: Array<{ id: string }> }>;
		} | null;
	}>(`/api/polls/organizations/${org.id}`, {
		name,
		vote_visibility: 'members-only',
		multiplechoicequestion_questions: [
			{ question: 'Are you in?', options: [{ option: 'Yes' }, { option: 'No' }] }
		],
		...options.poll
	});

	if (open) {
		await api.post(`/api/polls/${poll.id}/open`);
	}

	const question = poll.questionnaire?.multiple_choice_questions[0];
	if (!question) {
		throw new Error(`Poll ${poll.id} came back without its MC question`);
	}
	return {
		id: poll.id,
		orgSlug,
		path: `/org/${orgSlug}/polls/${poll.id}`,
		name,
		questionId: question.id,
		optionIds: question.options.map((o) => o.id)
	};
}

/**
 * RSVP a throwaway user to a non-ticketed event via the public API. Throws
 * ApiError (status 400) when the event is not accepting RSVPs — specs use
 * that to assert closed/cancelled events reject new attendance.
 */
export async function rsvpViaApi(
	user: ThrowawayUser,
	eventId: string,
	answer: 'yes' | 'no' | 'maybe'
): Promise<void> {
	const api = await ApiClient.login(user.email, user.password);
	await api.post(`/api/events/${eventId}/rsvp/${answer}`);
}

/**
 * Claim/reserve a ticket for a throwaway user straight through the public
 * checkout API — the ARRANGE step for specs whose journey starts from an
 * already-held ticket (check-in, ticket management). Free/offline tiers only:
 * an online tier answers with a Stripe checkout URL instead of tickets.
 * Pass `seatId` on USER_CHOICE tiers (ids come from `listAvailableSeats`).
 */
export async function claimTicketViaApi(
	user: ThrowawayUser,
	eventId: string,
	tierId: string,
	options: { seatId?: string } = {}
): Promise<{ id: string; status: string }> {
	const api = await ApiClient.login(user.email, user.password);
	const response = await api.post<{ tickets?: Array<{ id: string; status: string }> }>(
		`/api/events/${eventId}/tickets/${tierId}/checkout`,
		{
			tickets: [{ guest_name: `${user.firstName} ${user.lastName}`, seat_id: options.seatId }]
		}
	);
	const ticket = response.tickets?.[0];
	if (!ticket) {
		throw new Error(`Checkout for tier ${tierId} returned no tickets (online tier?)`);
	}
	return ticket;
}

/**
 * Delete the "General Admission" tier that a backend post-save signal
 * auto-creates on every ticketed event. Specs arranging offline/at-the-door
 * tiers must drop it: its card renders the same "Reserve Ticket" button as
 * theirs and trips Playwright's strict mode in the tier dialog.
 */
export async function deleteDefaultTier(
	eventId: string,
	owner: PersonaName = 'owner'
): Promise<void> {
	const persona = PERSONAS[owner];
	const api = await ApiClient.login(persona.email, persona.password);
	const tiers = await api.get<{ results: Array<{ id: string; name: string }> }>(
		`/api/event-admin/${eventId}/ticket-tiers`
	);
	const defaultTier = tiers.results.find((t) => t.name === 'General Admission');
	if (defaultTier) {
		await api.delete(`/api/event-admin/${eventId}/ticket-tier/${defaultTier.id}`);
	}
}

/**
 * Start an ONLINE (Stripe) checkout via the public API and return the hosted
 * checkout URL — the ARRANGE step for specs that need a PAID ticket but whose
 * journey under test starts after the purchase (self-cancel, buyer invoices).
 * Two requests since #464/BE#632: the checkout endpoint only RESERVES
 * (returning a `reservation_id`); the checkout-session endpoint creates the
 * Stripe session. The caller drives the returned URL with
 * completeStripeCheckout(); ticket activation still arrives via the
 * `stripe listen` webhook.
 */
export async function startOnlineCheckout(
	user: ThrowawayUser,
	eventId: string,
	tierId: string,
	options: { billingInfo?: Record<string, unknown> } = {}
): Promise<string> {
	const api = await ApiClient.login(user.email, user.password);
	const reserve = await api.post<{ reservation_id?: string; requires_payment?: boolean }>(
		`/api/events/${eventId}/tickets/${tierId}/checkout`,
		{
			tickets: [{ guest_name: `${user.firstName} ${user.lastName}` }],
			// An attendee invoice is only generated when the buyer supplied
			// billing info at checkout (payment.buyer_billing_snapshot).
			billing_info: options.billingInfo
		}
	);
	if (!reserve.requires_payment || !reserve.reservation_id) {
		throw new Error(`Checkout for tier ${tierId} returned no reservation_id (not an online tier?)`);
	}
	const session = await api.post<{ checkout_url?: string }>(
		`/api/events/reservations/${reserve.reservation_id}/checkout-session`
	);
	if (!session.checkout_url) {
		throw new Error(
			`Checkout-session for reservation ${reserve.reservation_id} returned no checkout_url`
		);
	}
	return session.checkout_url;
}

/**
 * Set a seeded org's attendee invoicing mode (dedicated endpoint — the
 * billing-info PATCH silently ignores the field). The suite-wide convention is
 * that every invoicing spec flips Org Alpha to 'hybrid' and DOESN'T revert:
 * the mode is read at WEBHOOK time, so two specs standing on different modes
 * would race each other's checkouts (an 'auto' flip mid-run turns another
 * spec's expected draft into an issued invoice, and vice versa). 'hybrid' is
 * harmless to non-invoicing suites — it only reveals the optional "Request
 * Invoice" checkbox on online checkouts.
 */
export async function setOrgInvoicingMode(
	mode: 'none' | 'hybrid' | 'auto',
	orgSlug = 'revel-events-collective',
	owner: PersonaName = 'owner'
): Promise<void> {
	const persona = PERSONAS[owner];
	const api = await ApiClient.login(persona.email, persona.password);
	await api.patch(`/api/organization-admin/${orgSlug}/invoicing`, { mode });
}

/**
 * Wait for the DRAFT attendee invoice a hybrid-mode checkout generated (the
 * Stripe webhook + inline Celery make it eventually-consistent) and ISSUE it
 * as the org owner — the ARRANGE step for buyer-side invoice specs now that
 * the suite pins Org Alpha to 'hybrid' (auto-issue no longer happens; the
 * organizer-side issue journey itself is j22 hybrid-flow).
 */
export async function issueDraftInvoiceFor(
	buyerEmail: string,
	orgSlug = 'revel-events-collective',
	timeoutMs = 120_000
): Promise<void> {
	const persona = PERSONAS.owner;
	const api = await ApiClient.login(persona.email, persona.password);
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		const page = await api.get<{ results: Array<{ id: string; status: string }> }>(
			`/api/organization-admin/${orgSlug}/attendee-invoices?search=${encodeURIComponent(buyerEmail)}`
		);
		const invoice = page.results[0];
		if (invoice) {
			if (invoice.status === 'draft') {
				await api.post(`/api/organization-admin/${orgSlug}/attendee-invoices/${invoice.id}/issue`);
			}
			return;
		}
		if (Date.now() > deadline) {
			throw new Error(`No attendee invoice for ${buyerEmail} within ${timeoutMs}ms`);
		}
		await new Promise((resolve) => setTimeout(resolve, 2_000));
	}
}

/**
 * Look up the bootstrap-seeded "Revel Concert Hall" (10×10 seat grid, rows
 * A–J) on Org Alpha — specs attach it to their OWN arranged tiers via
 * venue_id/sector_id so seat availability never collides with the seeded
 * classical-music-evening event (availability is per event, not per venue).
 */
export async function getSeededConcertHall(): Promise<{ venueId: string; sectorId: string }> {
	const persona = PERSONAS.owner;
	const api = await ApiClient.login(persona.email, persona.password);
	const venues = await api.get<{ results: Array<{ id: string; name: string }> }>(
		`/api/organization-admin/revel-events-collective/venues?page_size=50`
	);
	const hall = venues.results.find((v) => v.name === 'Revel Concert Hall');
	if (!hall) {
		throw new Error('Seeded "Revel Concert Hall" venue not found — re-run make bootstrap-tests');
	}
	// Plain array (not paginated), unlike the venues list.
	const sectors = await api.get<Array<{ id: string; name: string }>>(
		`/api/organization-admin/revel-events-collective/venues/${hall.id}/sectors`
	);
	const floor = sectors.find((s) => s.name === 'Main Floor');
	if (!floor) {
		throw new Error('Seeded "Main Floor" sector not found on Revel Concert Hall');
	}
	return { venueId: hall.id, sectorId: floor.id };
}

/** List a tier's seats with availability (public checkout endpoint). */
export async function listAvailableSeats(
	user: ThrowawayUser,
	eventId: string,
	tierId: string
): Promise<Array<{ id: string; label: string; available: boolean }>> {
	const api = await ApiClient.login(user.email, user.password);
	const sector = await api.get<{
		seats: Array<{ id: string; label: string; available: boolean }>;
	}>(`/api/events/${eventId}/tickets/${tierId}/seats`);
	return sector.seats;
}
