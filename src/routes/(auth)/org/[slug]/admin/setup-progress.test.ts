import { describe, expect, it } from 'vitest';
import type { OrganizationAdminDetailSchema } from '$lib/api/generated/types.gen';
import { buildSetupProgress, type SetupCounts } from './setup-progress';

type OrgSetupFields = Pick<
	OrganizationAdminDetailSchema,
	'visibility' | 'stripe_account_id' | 'stripe_charges_enabled'
>;

const NONE: SetupCounts = { eventCount: 0, publishedCount: 0, latestDraft: null };

function org(overrides: Partial<OrgSetupFields> = {}): OrgSetupFields {
	return {
		visibility: 'private',
		stripe_account_id: null,
		stripe_charges_enabled: false,
		...overrides
	} as OrgSetupFields;
}

describe('buildSetupProgress', () => {
	it('reports a fresh private org with nothing set up', () => {
		const p = buildSetupProgress(org(), NONE);
		expect(p).toMatchObject({
			pageHidden: true,
			event: 'none',
			latestDraft: null,
			stripe: 'none',
			doneCount: 1,
			total: 5,
			allDone: false
		});
	});

	it('hides the page for staff-only orgs', () => {
		expect(buildSetupProgress(org({ visibility: 'staff-only' }), NONE).pageHidden).toBe(true);
	});

	it('shows the page for members-only and unlisted orgs', () => {
		expect(buildSetupProgress(org({ visibility: 'members-only' }), NONE).pageHidden).toBe(false);
		expect(buildSetupProgress(org({ visibility: 'unlisted' }), NONE).pageHidden).toBe(false);
	});

	it('counts a visible page as done', () => {
		expect(buildSetupProgress(org({ visibility: 'public' }), NONE).doneCount).toBe(2);
	});

	it('reports a draft event and passes its latest draft through', () => {
		const draft = { id: 'e1', name: 'Gala' };
		const p = buildSetupProgress(org(), { eventCount: 1, publishedCount: 0, latestDraft: draft });
		expect(p.event).toBe('draft');
		expect(p.latestDraft).toEqual(draft);
		expect(p.doneCount).toBe(2);
	});

	it('reports a published event as published and counts it twice', () => {
		const p = buildSetupProgress(org(), { eventCount: 1, publishedCount: 1, latestDraft: null });
		expect(p.event).toBe('published');
		expect(p.doneCount).toBe(3);
	});

	it('reports an onboarding Stripe account as incomplete and does not count it', () => {
		const p = buildSetupProgress(
			org({ stripe_account_id: 'acct_1', stripe_charges_enabled: false }),
			NONE
		);
		expect(p.stripe).toBe('incomplete');
		expect(p.doneCount).toBe(1);
	});

	it('reports a Stripe account that can take charges as ready', () => {
		const p = buildSetupProgress(
			org({ stripe_account_id: 'acct_1', stripe_charges_enabled: true }),
			NONE
		);
		expect(p.stripe).toBe('ready');
		expect(p.doneCount).toBe(2);
	});

	it('marks everything done for a public, published, Stripe-ready org', () => {
		const p = buildSetupProgress(
			org({ visibility: 'public', stripe_account_id: 'acct_1', stripe_charges_enabled: true }),
			{ eventCount: 2, publishedCount: 1, latestDraft: null }
		);
		expect(p.doneCount).toBe(5);
		expect(p.allDone).toBe(true);
	});

	it('treats null counts as zero', () => {
		const p = buildSetupProgress(org(), {
			eventCount: null,
			publishedCount: null,
			latestDraft: null
		});
		expect(p.event).toBe('none');
		expect(p.doneCount).toBe(1);
	});
});
