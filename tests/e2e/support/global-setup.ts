import { randomUUID } from 'node:crypto';

/**
 * Runs once in the RUNNER process, before any worker is spawned.
 *
 * Its only job is to plant a per-run id in the environment. Workers are forked
 * after this hook and inherit it, which gives `support/stripe.ts` a key for the
 * cross-worker Stripe webhook verdict (see `expectWebhookEffect`) that no other
 * run — concurrent or later — can collide with. A module-level cache cannot do
 * that job: Playwright spawns a fresh worker after every test failure.
 *
 * An id supplied from outside wins, so a harness can correlate a run with its
 * own logs.
 */
export default function globalSetup(): void {
	process.env.E2E_RUN_ID ??= randomUUID();
}
