import crypto from 'node:crypto';
import { API_URL, ApiClient, ApiError } from './api';
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

	const register = await fetch(`${API_URL}/api/account/register`, {
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
	const verify = await fetch(`${API_URL}/api/account/verify`, {
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
 * API-create an OPEN, public event (owned by a seeded org owner), optionally
 * with an immediately-purchasable free tier. Specs use this instead of relying
 * on seeded events whose sales windows / capacity drift with the clock.
 */
export async function createTicketedEvent(
	options: {
		owner?: PersonaName;
		orgSlug?: string;
		freeTier?: boolean;
		event?: Record<string, unknown>;
	} = {}
): Promise<CreatedEvent> {
	const { owner = 'owner', orgSlug = 'revel-events-collective', freeTier = true } = options;
	const persona = PERSONAS[owner];
	const api = await ApiClient.login(persona.email, persona.password);

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
