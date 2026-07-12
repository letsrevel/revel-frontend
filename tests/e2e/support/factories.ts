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
	owner: PersonaName = 'owner'
): Promise<{ id: string; name: string }> {
	const persona = PERSONAS[owner];
	const api = await ApiClient.login(persona.email, persona.password);
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
	options: { acceptMembershipRequests?: boolean; contactEmail?: string } = {}
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

	if (options.acceptMembershipRequests) {
		await api.put(`/api/organization-admin/${org.slug}`, {
			visibility: 'public',
			accept_membership_requests: true
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
 */
export async function claimTicketViaApi(
	user: ThrowawayUser,
	eventId: string,
	tierId: string
): Promise<{ id: string; status: string }> {
	const api = await ApiClient.login(user.email, user.password);
	const response = await api.post<{ tickets?: Array<{ id: string; status: string }> }>(
		`/api/events/${eventId}/tickets/${tierId}/checkout`,
		{ tickets: [{ guest_name: `${user.firstName} ${user.lastName}` }] }
	);
	const ticket = response.tickets?.[0];
	if (!ticket) {
		throw new Error(`Checkout for tier ${tierId} returned no tickets (online tier?)`);
	}
	return ticket;
}
