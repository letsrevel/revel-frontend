/**
 * Personas map 1:1 to users seeded by the backend's `make bootstrap`
 * (see revel-backend bootstrap_events / bootstrap_test_events).
 *
 * Specs consume them through the persona fixtures in fixtures.ts (`asOwner`,
 * `asMember`, …), which log in via the API per test — see fixtures.ts for why
 * sessions are never shared between contexts.
 *
 * Destructive account flows (deletion, email change, 2FA enable) must register
 * their own throwaway users — never mutate a shared persona's account.
 */
export interface Persona {
	/** Stable identifier; also the storageState file basename. */
	readonly id: string;
	readonly email: string;
	readonly password: string;
	/** What the seed makes this user — for picking the right persona in specs. */
	readonly description: string;
}

const BOOTSTRAP_PASSWORD = 'password123';

function persona(id: string, email: string, description: string): Persona {
	return { id, email, password: BOOTSTRAP_PASSWORD, description };
}

export const PERSONAS = {
	owner: persona(
		'owner',
		'alice.owner@example.com',
		'Org Alpha (revel-events-collective) owner — Stripe-connected org, venue, seated event'
	),
	staff: persona('staff', 'bob.staff@example.com', 'Org Alpha staff'),
	member: persona(
		'member',
		'charlie.member@example.com',
		'Org Alpha member (General tier), holds seeded tickets'
	),
	user: persona(
		'user',
		'hannah.attendee@example.com',
		'Plain user with no org membership; follows Org Alpha'
	),
	user2: persona(
		'user2',
		'ivan.attendee@example.com',
		'Plain user with no org membership; follows Org Beta (parallel-safe twin of `user`)'
	),
	multiOrg: persona(
		'multiOrg',
		'karen.multiorg@example.com',
		'Org Alpha Founders tier + Org Beta General member'
	),
	betaOwner: persona(
		'betaOwner',
		'diana.owner@example.com',
		'Org Beta (tech-innovators-network) owner — questionnaires, no Stripe'
	),
	betaMember: persona(
		'betaMember',
		'frank.member@example.com',
		'Org Beta member (General tier), RSVP-yes on its seeded members-only events'
	),
	testAdmin: persona(
		'testAdmin',
		'test.admin@example.com',
		'Eligibility-matrix org (eligibility-test-org) owner'
	),
	testMember: persona(
		'testMember',
		'test.member@example.com',
		'Eligibility-matrix org member, invited to its private test event'
	)
} as const satisfies Record<string, Persona>;

export type PersonaName = keyof typeof PERSONAS;
