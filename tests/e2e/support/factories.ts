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

/**
 * Add a membership tier to an org. `owner` accepts a persona name too, because
 * ONLINE plans can only exist on the Stripe-connected seeded Org Alpha — every
 * hosted-checkout spec arranges its tiers there as `'owner'` (alice).
 */
export async function createMembershipTier(
	owner: PersonaName | ThrowawayUser,
	orgSlug: string,
	name: string
): Promise<{ id: string }> {
	const credentials = typeof owner === 'string' ? PERSONAS[owner] : owner;
	const api = await ApiClient.login(credentials.email, credentials.password);
	return api.post<{ id: string }>(`/api/organization-admin/${orgSlug}/membership-tiers`, { name });
}

/**
 * API-create a subscription plan on a membership tier (defaults: €15.00
 * monthly, OFFLINE — the backend's own default payment method). ARRANGE step
 * for the subscription journeys — plan AUTHORING through the UI is j23
 * plans-admin. Extra plan fields (`payment_method: 'online'`,
 * `max_subscriptions`, `sales_status`, `period_unit`, …) are spread onto the
 * payload as given.
 *
 * `owner` accepts a persona name: ONLINE plans require Stripe Connect, which
 * only the seeded Org Alpha has, so they are created as `'owner'` (alice).
 */
export async function createSubscriptionPlan(
	owner: PersonaName | ThrowawayUser,
	orgSlug: string,
	tierId: string,
	plan: Record<string, unknown> = {}
): Promise<{ id: string; name: string }> {
	const credentials = typeof owner === 'string' ? PERSONAS[owner] : owner;
	const api = await ApiClient.login(credentials.email, credentials.password);
	const name = (plan.name as string) ?? uniqueName('Plan');
	const created = await api.post<{ id: string }>(
		`/api/organization-admin/${orgSlug}/tiers/${tierId}/plans`,
		{ name, price: '15.00', currency: 'EUR', ...plan }
	);
	return { id: created.id, name };
}

/**
 * PATCH a subscription plan (`sales_status`, `max_subscriptions`, price, …).
 * `payment_method` is deliberately NOT patchable backend-side — archive the
 * plan and create a new one instead.
 */
export async function updateSubscriptionPlan(
	owner: PersonaName | ThrowawayUser,
	orgSlug: string,
	planId: string,
	patch: Record<string, unknown>
): Promise<void> {
	const credentials = typeof owner === 'string' ? PERSONAS[owner] : owner;
	const api = await ApiClient.login(credentials.email, credentials.password);
	await api.patch(`/api/organization-admin/${orgSlug}/plans/${planId}`, patch);
}

/**
 * Archive a subscription plan (POST …/plans/{id}/archive → `is_active=False`).
 *
 * The CLEANUP counterpart to `createSubscriptionPlan`: an archived plan stops
 * being offered on the public org page and is refused by `subscribe`, while the
 * subscriptions that reference it survive (unlike DELETE, which the backend
 * blocks once any subscription points at the plan). Specs that mint a throwaway
 * plan on a SHARED org — Org Alpha is the only Stripe-connected one — archive it
 * afterwards so the org's public page does not accumulate test plans.
 */
export async function archiveSubscriptionPlan(
	owner: PersonaName | ThrowawayUser,
	orgSlug: string,
	planId: string
): Promise<void> {
	const credentials = typeof owner === 'string' ? PERSONAS[owner] : owner;
	const api = await ApiClient.login(credentials.email, credentials.password);
	await api.post(`/api/organization-admin/${orgSlug}/plans/${planId}/archive`);
}

/**
 * The org's UUID, read from the PUBLIC retrieve endpoint (no auth needed).
 * Member-facing subscription endpoints are keyed by org id, not slug.
 */
export async function getOrganizationId(slug: string): Promise<string> {
	const response = await fetchWithRetry(`${API_URL}/api/organizations/${slug}`);
	if (!response.ok) {
		throw new ApiError(response.status, 'GET', `/api/organizations/${slug}`, await response.text());
	}
	const org = (await response.json()) as { id?: string };
	if (!org.id) {
		throw new Error(`Organization ${slug} has no id`);
	}
	return org.id;
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
	owner: PersonaName | ThrowawayUser = 'owner'
): Promise<void> {
	const credentials = typeof owner === 'string' ? PERSONAS[owner] : owner;
	const api = await ApiClient.login(credentials.email, credentials.password);
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
 * API-create an ISOLATED plain concert hall: one "Main Floor" sector holding
 * a clean 10×10 unpainted seat grid (rows A–J, seats 1–10, all active) —
 * specs attach it to their OWN arranged tiers via venue_id/sector_id.
 *
 * Historically this looked up the bootstrap-seeded "Revel Concert Hall", but
 * BE a42ecd08 reshaped that venue into the zone-painted Orchestra/Balcony
 * showcase (painted seats force category pricing on any tier sold there),
 * so the flat-price seat specs bring their own venue instead — same
 * isolation rationale as createCategoryPricedVenue.
 */
export async function createPlainConcertHall(): Promise<{ venueId: string; sectorId: string }> {
	const persona = PERSONAS.owner;
	const api = await ApiClient.login(persona.email, persona.password);
	const venue = await api.post<{ id: string }>(
		`/api/organization-admin/revel-events-collective/venues`,
		{ name: uniqueName('Plain Hall') }
	);
	const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
	const seats = rows.flatMap((row, rowIndex) =>
		Array.from({ length: 10 }, (_, i) => ({
			label: `${row}${i + 1}`,
			row,
			number: i + 1,
			row_order: rowIndex,
			adjacency_index: i + 1,
			price_category_id: null
		}))
	);
	const sector = await api.post<{ id: string }>(
		`/api/organization-admin/revel-events-collective/venues/${venue.id}/sectors`,
		{ name: 'Main Floor', seats }
	);
	return { venueId: venue.id, sectorId: sector.id };
}

/**
 * List an event's seats with availability via the seating phase-1 endpoints
 * (GET /seating/chart joined with GET /seating/availability). The availability
 * map is SPARSE — a seat id absent from it is available; present values are
 * 'sold' | 'held' | 'blocked'. Replaces the legacy per-tier
 * /tickets/{tier}/seats endpoint (chart + availability are per event).
 */
export async function listAvailableSeats(
	user: ThrowawayUser,
	eventId: string
): Promise<Array<{ id: string; label: string; available: boolean }>> {
	const api = await ApiClient.login(user.email, user.password);
	const chart = await api.get<{
		sectors: Array<{
			kind?: string | null;
			seats?: Array<{ id: string; label: string; is_active?: boolean }>;
		}>;
	}>(`/api/events/${eventId}/seating/chart`);
	const availability = await api.get<{ seats?: Record<string, string> }>(
		`/api/events/${eventId}/seating/availability`
	);
	const taken = availability.seats ?? {};
	return chart.sectors.flatMap((sector) =>
		(sector.seats ?? [])
			.filter((seat) => seat.is_active !== false)
			.map((seat) => ({ id: seat.id, label: seat.label, available: !(seat.id in taken) }))
	);
}

// ---- Seating phase 1/2 arrange helpers (J19) ----

/** Render-ready seating chart, as served by GET /events/{id}/seating/chart. */
export interface SeatingChart {
	venue_id: string;
	venue_name: string;
	price_categories: Array<{ id: string; name: string; color: string; display_order: number }>;
	sectors: Array<{
		id: string;
		name: string;
		kind?: string;
		capacity?: number | null;
		seats?: Array<{
			id: string;
			label: string;
			row_label?: string | null;
			number?: number | null;
			is_accessible?: boolean;
			is_active?: boolean;
			price_category_id?: string | null;
		}>;
	}>;
}

/** Sparse availability map — a seat id absent from `seats` is available. */
export interface SeatingAvailability {
	seats: Record<string, 'sold' | 'held' | 'blocked'>;
	standing: Record<string, { capacity: number | null; taken: number }>;
	my_holds: string[];
	my_holds_expire_at: string | null;
}

/**
 * Raw chart fetcher (GET /events/{id}/seating/chart). Anonymous when no
 * identity is given — the chart is public for public events.
 */
export async function getSeatingChart(
	eventId: string,
	as?: PersonaName | ThrowawayUser
): Promise<SeatingChart> {
	const path = `/api/events/${eventId}/seating/chart`;
	if (as) {
		const credentials = typeof as === 'string' ? PERSONAS[as] : as;
		const api = await ApiClient.login(credentials.email, credentials.password);
		return api.get<SeatingChart>(path);
	}
	const response = await fetchWithRetry(`${API_URL}${path}`);
	if (!response.ok) {
		throw new ApiError(response.status, 'GET', path, await response.text());
	}
	return (await response.json()) as SeatingChart;
}

/**
 * Raw availability fetcher (GET /events/{id}/seating/availability). Pass an
 * identity to see that caller's `my_holds`; anonymous fetches carry no hold
 * identity (no cookie jar), so `my_holds` is always empty there.
 */
export async function getSeatingAvailability(
	eventId: string,
	as?: PersonaName | ThrowawayUser
): Promise<SeatingAvailability> {
	const path = `/api/events/${eventId}/seating/availability`;
	if (as) {
		const credentials = typeof as === 'string' ? PERSONAS[as] : as;
		const api = await ApiClient.login(credentials.email, credentials.password);
		return api.get<SeatingAvailability>(path);
	}
	const response = await fetchWithRetry(`${API_URL}${path}`);
	if (!response.ok) {
		throw new ApiError(response.status, 'GET', path, await response.text());
	}
	return (await response.json()) as SeatingAvailability;
}

/**
 * Acquire 10-minute TTL holds on specific seats as the given identity — the
 * ARRANGE step for foreign-hold conflicts (another buyer's live hold renders
 * as `held` and blocks user-choice checkout). All-or-nothing server-side:
 * throws ApiError 409 (conflict_reason 'unavailable' | 'capacity') when any
 * requested seat can't be held. Holds expire on their own; release explicitly
 * via releaseHoldsViaApi when the spec needs the seats freed sooner.
 */
export async function holdSeatsViaApi(
	user: PersonaName | ThrowawayUser,
	eventId: string,
	seatIds: string[]
): Promise<{ held_seat_ids: string[]; expires_at: string | null }> {
	const credentials = typeof user === 'string' ? PERSONAS[user] : user;
	const api = await ApiClient.login(credentials.email, credentials.password);
	return api.post<{ held_seat_ids: string[]; expires_at: string | null }>(
		`/api/events/${eventId}/seating/holds`,
		{ seat_ids: seatIds }
	);
}

/**
 * Release the identity's live holds on an event — all of them by default, or
 * a subset when `seatIds` is given. Safe to call with nothing held.
 */
export async function releaseHoldsViaApi(
	user: PersonaName | ThrowawayUser,
	eventId: string,
	seatIds?: string[]
): Promise<void> {
	const credentials = typeof user === 'string' ? PERSONAS[user] : user;
	const api = await ApiClient.login(credentials.email, credentials.password);
	await api.request('DELETE', `/api/events/${eventId}/seating/holds`, {
		seat_ids: seatIds ?? null
	});
}

/**
 * API-create a venue price category (POST /organization-admin/{slug}/venues/
 * {venue_id}/price-categories). Seats can be painted with it via
 * PUT /venues/{venue_id}/seats/paint, or inline at seat creation
 * (`price_category_id` on the seat input) — see createCategoryPricedVenue.
 */
export async function createPriceCategory(
	orgSlug: string,
	venueId: string,
	payload: Record<string, unknown> = {},
	owner: PersonaName | ThrowawayUser = 'owner'
): Promise<{ id: string; name: string }> {
	const credentials = typeof owner === 'string' ? PERSONAS[owner] : owner;
	const api = await ApiClient.login(credentials.email, credentials.password);
	const name = (payload.name as string) ?? uniqueName('Category');
	const created = await api.post<{ id: string }>(
		`/api/organization-admin/${orgSlug}/venues/${venueId}/price-categories`,
		{ name, color: '#7c3aed', display_order: 0, ...payload }
	);
	return { id: created.id, name };
}

export interface CategoryPricedVenue {
	venueId: string;
	sectorId: string;
	/** Painted onto every row-A seat; rows B stays unpainted. */
	category: { id: string; name: string };
}

/**
 * Create an ISOLATED venue for per-seat-category pricing specs (#668): one
 * seated sector with rows A–B × 4 seats, where row A is painted with a fresh
 * price category (inline `price_category_id`) and row B stays unpainted.
 *
 * Isolation matters: painting a new category onto a SHARED venue would make
 * any category-priced tier being saved concurrently by another worker
 * under-covered (the backend validates coverage against every category
 * painted in the tier's sector), so pricing specs must bring their own venue.
 */
export async function createCategoryPricedVenue(
	orgSlug: string,
	owner: PersonaName | ThrowawayUser = 'owner'
): Promise<CategoryPricedVenue> {
	const credentials = typeof owner === 'string' ? PERSONAS[owner] : owner;
	const api = await ApiClient.login(credentials.email, credentials.password);
	const venue = await api.post<{ id: string }>(`/api/organization-admin/${orgSlug}/venues`, {
		name: uniqueName('Priced Hall')
	});
	const category = await createPriceCategory(
		orgSlug,
		venue.id,
		{ name: uniqueName('Front'), color: '#f9b233' },
		owner
	);
	const seats = ['A', 'B'].flatMap((row, rowIndex) =>
		Array.from({ length: 4 }, (_, i) => ({
			label: `${row}${i + 1}`,
			row,
			number: i + 1,
			row_order: rowIndex,
			adjacency_index: i + 1,
			price_category_id: row === 'A' ? category.id : null
		}))
	);
	const sector = await api.post<{ id: string }>(
		`/api/organization-admin/${orgSlug}/venues/${venue.id}/sectors`,
		{ name: 'Orchestra', seats }
	);
	return { venueId: venue.id, sectorId: sector.id, category };
}

export interface SeededBestAvailableEvent {
	eventId: string;
	/** Public detail path, e.g. /events/org-0/teatro-grande-traviata. */
	eventPath: string;
	eventName: string;
	/** The BEST_AVAILABLE tier (offline payment, painted "Galleria" pool). */
	tier: { id: string; name: string };
}

/**
 * Buyer-side lookup of the seeded showcase event for best-available arranges:
 * "La Traviata — Season Opening" at Teatro Grande, whose "Galleria" tier is
 * BEST_AVAILABLE on a seed-painted ~570-seat price-category pool (showcase
 * seeder #717). Painted pools are seed-only (see createPriceCategory) and the
 * showcase org owners are not discoverable via API, so specs consume this
 * SHARED event directly through the public endpoints (event list + tiers, no
 * auth) instead of arranging their own.
 *
 * Because availability is shared: buy as a FRESH createVerifiedUser (the
 * event caps tickets at 4 per user, so a reused identity stops claiming),
 * and never assert absolute availability counts.
 */
export async function getSeededBestAvailableEvent(
	// The seeded event now carries TWO best_available tiers (pricing
	// convergence): "Galleria" (mapped, single zone) and "Platea — Best
	// Available" (mapped, two zones at two prices). Pin by name.
	tierName = 'Galleria'
): Promise<SeededBestAvailableEvent> {
	const eventName = 'La Traviata — Season Opening';
	const listPath = `/api/events/?search=${encodeURIComponent('La Traviata')}`;
	const listResponse = await fetchWithRetry(`${API_URL}${listPath}`);
	if (!listResponse.ok) {
		throw new ApiError(listResponse.status, 'GET', listPath, await listResponse.text());
	}
	const list = (await listResponse.json()) as {
		results: Array<{ id: string; name: string; slug: string; organization: { slug: string } }>;
	};
	const event = list.results.find((e) => e.name === eventName);
	if (!event) {
		throw new Error(
			`Seeded showcase event "${eventName}" not found via public search — showcase seed (#717) missing, re-run make bootstrap`
		);
	}
	const tiersPath = `/api/events/${event.id}/tickets/tiers`;
	const tiersResponse = await fetchWithRetry(`${API_URL}${tiersPath}`);
	if (!tiersResponse.ok) {
		throw new ApiError(tiersResponse.status, 'GET', tiersPath, await tiersResponse.text());
	}
	const tiers = (await tiersResponse.json()) as Array<{
		id: string;
		name: string;
		seat_assignment_mode: string;
	}>;
	const tier = tiers.find(
		(t) => t.seat_assignment_mode === 'best_available' && t.name === tierName
	);
	if (!tier) {
		throw new Error(
			`No best_available tier "${tierName}" on seeded "${eventName}" — re-run make bootstrap`
		);
	}
	return {
		eventId: event.id,
		eventPath: `/events/${event.organization.slug}/${event.slug}`,
		eventName,
		tier: { id: tier.id, name: tier.name }
	};
}

// ---- Membership applications & subscriptions (j23 / j27) ----

/**
 * Apply for membership straight through the member API
 * (POST /me/organizations/{slug}/apply).
 *
 * The outcome depends entirely on the org/tier policy, so specs read the
 * returned `status`: a TIER-BEARING apply against an org with no gate (no
 * approval requirement, no questionnaire) comes back `completed` — the
 * membership exists already. A TIER-LESS apply (what the UI's ApplyDialog
 * sends) stays `pending` for staff, because the backend never resolves a
 * default tier on the member's behalf.
 *
 * `nextStep` is the eligibility verdict's `next_step` (null once there is
 * nothing left to do) — the same field MembershipCta switches its CTA on.
 *
 * `submissionId` attaches the questionnaire submission that satisfied the
 * gate — the audit pointer the org-admin request card turns into its
 * "View questionnaire submission" link. The UI never sends it (ApplyDialog
 * posts tier + notes only), so specs that need a submission-bearing row
 * arrange it here. The backend validates it: it must be a READY submission
 * owned by `user` for the questionnaire that actually gates this (org, tier),
 * or the call 422s.
 */
export async function applyViaApi(
	user: ThrowawayUser,
	orgSlug: string,
	opts: { tierId?: string; notes?: string; submissionId?: string } = {}
): Promise<{ applicationId: string; status: string; nextStep: string | null }> {
	const api = await ApiClient.login(user.email, user.password);
	const response = await api.post<{
		application: { id?: string | null; status: string };
		eligibility: { next_step?: string | null };
	}>(`/api/me/organizations/${orgSlug}/apply`, {
		tier_id: opts.tierId ?? null,
		notes: opts.notes,
		questionnaire_submission_id: opts.submissionId ?? null
	});
	const applicationId = response.application.id;
	if (!applicationId) {
		throw new Error(`Apply to ${orgSlug} returned an application without an id`);
	}
	return {
		applicationId,
		status: response.application.status,
		nextStep: response.eligibility.next_step ?? null
	};
}

/** Withdraw one of the caller's own applications (idempotent server-side). */
export async function cancelApplicationViaApi(
	user: ThrowawayUser,
	applicationId: string
): Promise<void> {
	const api = await ApiClient.login(user.email, user.password);
	await api.post(`/api/me/applications/${applicationId}/cancel`);
}

/**
 * Approve a membership application from the org-admin side. An application and
 * the legacy membership request are the same row, so this is the same endpoint
 * as approveMembershipRequest — but with `tier_id` OPTIONAL: an application
 * that already carries a tier resolves its own, and only a tier-less
 * (UI-created) one needs staff to pick.
 *
 * Approving does NOT create the membership — the state machine advances on the
 * member's next read of the application (GET /me/applications/{id}), which the
 * account hub's Applications section fires on every mount.
 */
export async function approveApplication(
	owner: ThrowawayUser | 'owner',
	orgSlug: string,
	requestId: string,
	tierId?: string
): Promise<void> {
	const credentials = typeof owner === 'string' ? PERSONAS[owner] : owner;
	const api = await ApiClient.login(credentials.email, credentials.password);
	await api.post(
		`/api/organization-admin/${orgSlug}/membership-requests/${requestId}/approve`,
		tierId ? { tier_id: tierId } : {}
	);
}

/** Reject a membership application from the org-admin side. */
export async function rejectApplication(
	owner: ThrowawayUser | 'owner',
	orgSlug: string,
	requestId: string
): Promise<void> {
	const credentials = typeof owner === 'string' ? PERSONAS[owner] : owner;
	const api = await ApiClient.login(credentials.email, credentials.password);
	await api.post(`/api/organization-admin/${orgSlug}/membership-requests/${requestId}/reject`);
}

/**
 * Set an org's membership-eligibility policy (the org-level defaults every
 * tier inherits unless it overrides them).
 *
 * READ-THEN-PUT, defensively: the endpoint takes OrganizationEditSchema, and
 * the BE update path currently applies it with `model_dump(exclude_unset=True)`
 * (organization_service/lifecycle.py), so omitted fields are simply left alone
 * — a policy-only PUT would NOT lose data today (see `createOrganization`
 * above, which does a harmless naive 2-field PUT). This factory still echoes
 * back EVERY writable field of OrganizationEditSchema as the admin retrieve
 * currently reports it, with only the caller's keys overridden: a full
 * representation write stays correct even if those update semantics ever
 * change, and makes each write self-documenting about the org state it leaves
 * behind.
 *
 * Two fields are deliberately never sent: `contact_email` (excluded from the
 * edit schema — it has its own verification flow) and `tags` (not writable
 * here). `city` is the one shape mismatch: the retrieve nests the whole city
 * object, the edit schema wants its id.
 */
export async function setOrgMembershipPolicy(
	owner: ThrowawayUser,
	orgSlug: string,
	policy: {
		requiresApproval?: boolean;
		defaultQuestionnaireId?: string | null;
		revivalWindowDays?: number;
	}
): Promise<void> {
	const api = await ApiClient.login(owner.email, owner.password);
	const current = await api.get<{
		visibility: string;
		accept_membership_requests: boolean;
		contact_method: string;
		revenue_report_cadence: string;
		description?: string | null;
		instagram_url?: string | null;
		facebook_url?: string | null;
		bluesky_url?: string | null;
		telegram_url?: string | null;
		city?: { id?: number | null } | null;
		address?: string | null;
		location_maps_url?: string | null;
		location_maps_embed?: string | null;
		membership_grace_period_days: number;
		membership_subscription_revival_window_days: number;
		membership_refund_policy: string;
		default_membership_questionnaire_id?: string | null;
		default_requires_membership_approval: boolean;
	}>(`/api/organization-admin/${orgSlug}`);
	await api.put(`/api/organization-admin/${orgSlug}`, {
		// Echoed back unchanged.
		visibility: current.visibility,
		accept_membership_requests: current.accept_membership_requests,
		contact_method: current.contact_method,
		revenue_report_cadence: current.revenue_report_cadence,
		description: current.description ?? '',
		instagram_url: current.instagram_url ?? null,
		facebook_url: current.facebook_url ?? null,
		bluesky_url: current.bluesky_url ?? null,
		telegram_url: current.telegram_url ?? null,
		city_id: current.city?.id ?? null,
		address: current.address ?? null,
		location_maps_url: current.location_maps_url ?? null,
		location_maps_embed: current.location_maps_embed ?? null,
		membership_grace_period_days: current.membership_grace_period_days,
		membership_refund_policy: current.membership_refund_policy,
		// Overridable.
		membership_subscription_revival_window_days:
			policy.revivalWindowDays ?? current.membership_subscription_revival_window_days,
		// `undefined` means "leave alone"; an explicit `null` clears it.
		default_membership_questionnaire_id:
			policy.defaultQuestionnaireId !== undefined
				? policy.defaultQuestionnaireId
				: (current.default_membership_questionnaire_id ?? null),
		default_requires_membership_approval:
			policy.requiresApproval ?? current.default_requires_membership_approval
	});
}

/**
 * Override a single TIER's eligibility policy (PUT membership-tiers/{id};
 * MembershipTierUpdateSchema is fully partial, so unsent fields keep their
 * value). `requires_membership_approval` is tri-state — `null` means "inherit
 * the org default".
 *
 * The generated field is `membership_questionnaire_id`; the shorter
 * `membership_questionnaire` key here is the spec-facing name, mapped on the
 * way out.
 */
export async function patchTierPolicy(
	owner: ThrowawayUser,
	orgSlug: string,
	tierId: string,
	patch: {
		membership_questionnaire?: string | null;
		requires_membership_approval?: boolean | null;
	}
): Promise<void> {
	const api = await ApiClient.login(owner.email, owner.password);
	await api.put(`/api/organization-admin/${orgSlug}/membership-tiers/${tierId}`, {
		...('membership_questionnaire' in patch
			? { membership_questionnaire_id: patch.membership_questionnaire }
			: {}),
		...('requires_membership_approval' in patch
			? { requires_membership_approval: patch.requires_membership_approval }
			: {})
	});
}

/** The single question createMembershipQuestionnaire asks, per mode — exported
 *  so specs answer it by name instead of guessing at the wording. */
export const MEMBERSHIP_QUESTION = {
	/** Auto-graded multiple choice — asked in `'automatic'` AND `'hybrid'` mode. */
	automatic: {
		question: 'Do you agree to the code of conduct?',
		correct: 'Yes, I agree',
		wrong: 'No, rules are not for me'
	},
	/** Free text, for a human to read. */
	manual: { question: 'Why do you want to join?' }
} as const;

/**
 * Create a PUBLISHED MEMBERSHIP questionnaire on a throwaway-owned org — the
 * org-level or tier-level JOIN gate, never attached to an event (that is
 * attachAdmissionQuestionnaire's job). Exactly one mandatory question, whose
 * TYPE follows the evaluation mode (see MEMBERSHIP_QUESTION):
 *
 *   * `'automatic'` — one multiple-choice question with a correct option, the
 *     house pattern for deterministic inline grading. A free-text question
 *     here is rejected outright (422 `missing_llm_guidelines`: automatic
 *     grading of prose needs an LLM, which no E2E run should depend on).
 *     With `min_score: 0` any answer passes, so the gate clears itself.
 *   * `'manual'` — one free-text question; the submission parks in the org's
 *     review queue until staff grade it. NOTE: manual mode queues NO
 *     evaluation at all (see `submit_membership_questionnaire`: only
 *     automatic/hybrid enqueue the task), so the submission's
 *     `evaluation_status` stays NULL forever — nothing renders a
 *     "pending review" hint off a manual submission.
 *   * `'hybrid'` — the same auto-gradable multiple choice as `'automatic'`
 *     (free text would need LLM guidelines here too), but the grader files the
 *     evaluation as PENDING REVIEW instead of finalizing it. This is the only
 *     mode that yields `evaluation_status: 'pending review'` — what the
 *     org-admin request card's "Review pending" hint keys on.
 *
 * The returned id is the ORGANIZATION-QUESTIONNAIRE WRAPPER's — what
 * `default_membership_questionnaire_id` / `membership_questionnaire_id` want.
 * It is NOT the id the join-eligibility verdict carries in
 * `questionnaire_id` (the inner Questionnaire, which is what the
 * /org/{slug}/questionnaire/{id} route takes), so specs must build that URL
 * from the eligibility verdict or the CTA link, never from this return value.
 */
export async function createMembershipQuestionnaire(
	owner: ThrowawayUser,
	orgSlug: string,
	opts: { evaluationMode: 'automatic' | 'manual' | 'hybrid' }
): Promise<{ id: string }> {
	const api = await ApiClient.login(owner.email, owner.password);
	const org = await api.get<{ id: string }>(`/api/organizations/${orgSlug}`);
	const questions =
		opts.evaluationMode !== 'manual'
			? {
					multiplechoicequestion_questions: [
						{
							question: MEMBERSHIP_QUESTION.automatic.question,
							is_mandatory: true,
							is_fatal: true,
							shuffle_options: false,
							options: [
								{ option: MEMBERSHIP_QUESTION.automatic.correct, is_correct: true, order: 0 },
								{ option: MEMBERSHIP_QUESTION.automatic.wrong, order: 1 }
							]
						}
					]
				}
			: {
					freetextquestion_questions: [
						{ question: MEMBERSHIP_QUESTION.manual.question, is_mandatory: true }
					]
				};
	return api.post<{ id: string }>(`/api/questionnaires/${org.id}/create-questionnaire`, {
		name: uniqueName('Membership Questionnaire'),
		min_score: 0,
		evaluation_mode: opts.evaluationMode,
		status: 'published',
		questionnaire_type: 'membership',
		...questions
	});
}

/**
 * Member-initiated subscribe on an ONLINE plan (POST
 * /me/organizations/{org_id}/subscribe) — returns the local subscription plus
 * the hosted Stripe Checkout URL the spec then drives with
 * completeStripeCheckout(). OFFLINE plans are refused here by design; use
 * staffCreateOfflineSubscription for those.
 */
export async function subscribeViaApi(
	user: ThrowawayUser,
	orgId: string,
	planId: string
): Promise<{ subscriptionId: string; checkoutUrl: string | null }> {
	const api = await ApiClient.login(user.email, user.password);
	const response = await api.post<{
		subscription: { id?: string | null };
		checkout_url?: string | null;
	}>(`/api/me/organizations/${orgId}/subscribe`, { plan_id: planId });
	const subscriptionId = response.subscription.id;
	if (!subscriptionId) {
		throw new Error(`Subscribe to plan ${planId} returned a subscription without an id`);
	}
	return { subscriptionId, checkoutUrl: response.checkout_url ?? null };
}

/**
 * Staff-create a subscription on behalf of a member (OFFLINE plans only — the
 * backend refuses ONLINE ones here so the member can confirm their own first
 * payment). Recording an initial payment is what puts the subscription in an
 * ACTIVE, paid-up state; omit it to arrange a still-unpaid row. `currency`
 * defaults to 'EUR' whenever an `amount` is given (and is left unset without
 * one, so no currency is recorded for a payment that never happened).
 */
export async function staffCreateOfflineSubscription(
	owner: ThrowawayUser | 'owner',
	orgSlug: string,
	opts: { planId: string; userId: string; amount?: string; currency?: string }
): Promise<{ id: string }> {
	const credentials = typeof owner === 'string' ? PERSONAS[owner] : owner;
	const api = await ApiClient.login(credentials.email, credentials.password);
	return api.post<{ id: string }>(`/api/organization-admin/${orgSlug}/subscriptions`, {
		plan_id: opts.planId,
		user_id: opts.userId,
		initial_payment_amount: opts.amount,
		initial_payment_currency: opts.currency ?? (opts.amount ? 'EUR' : undefined)
	});
}
