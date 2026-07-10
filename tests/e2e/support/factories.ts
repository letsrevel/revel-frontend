import crypto from 'node:crypto';

/**
 * Arrange-data factories.
 *
 * Mutating journey specs API-create their own uniquely-named data so parallel
 * workers and repeated runs never collide (the bootstrap seed is reset only via
 * `make reset-events && make bootstrap`, never by tests).
 *
 * Factories grow here as the journey suites need them (createTicketedEvent,
 * createEventToken, createDiscountCode, …) — each a small wrapper over
 * ApiClient with a uniqueName()-based name. Phase 0 ships only the naming
 * helper; adding a factory before a spec needs it is premature.
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
