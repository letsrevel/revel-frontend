import { describe, expect, it } from 'vitest';
import type { OrganizationAdminDetailSchema } from '$lib/api/generated/types.gen';
import {
	billingNeedsAttention,
	buildSetupProgress,
	isPageHidden,
	shouldShowSetupCard,
	type SetupCounts
} from './org-setup-progress';

type OrgSetupFields = Pick<
	OrganizationAdminDetailSchema,
	| 'visibility'
	| 'stripe_account_id'
	| 'stripe_charges_enabled'
	| 'is_stripe_connected'
	| 'platform_fee_percent'
	| 'platform_fee_fixed'
	| 'vat_country_code'
	| 'billing_address'
	| 'billing_name'
>;

const NONE: SetupCounts = { eventCount: 0, publishedCount: 0, latestDraft: null };

function org(overrides: Partial<OrgSetupFields> = {}): OrgSetupFields {
	return {
		visibility: 'private',
		stripe_account_id: null,
		stripe_charges_enabled: false,
		is_stripe_connected: false,
		platform_fee_percent: '0',
		platform_fee_fixed: '0',
		vat_country_code: 'IT',
		billing_address: 'Via Roma 1',
		billing_name: 'Acme',
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

	it('presents events without a reviewable draft (cancelled-only, failed lookup) as none', () => {
		const p = buildSetupProgress(org(), { eventCount: 2, publishedCount: 0, latestDraft: null });
		expect(p.event).toBe('none');
		expect(p.doneCount).toBe(1);
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

describe('isPageHidden', () => {
	it('is true only for private and staff-only', () => {
		expect(isPageHidden('private')).toBe(true);
		expect(isPageHidden('staff-only')).toBe(true);
		expect(isPageHidden('public')).toBe(false);
		expect(isPageHidden('members-only')).toBe(false);
	});
});

describe('shouldShowSetupCard', () => {
	it('hides once an event is published, even with Stripe and visibility outstanding', () => {
		const p = buildSetupProgress(org(), { eventCount: 1, publishedCount: 1, latestDraft: null });
		expect(p.allDone).toBe(false);
		expect(shouldShowSetupCard(p)).toBe(false);
	});

	it('shows for none and draft', () => {
		expect(shouldShowSetupCard(buildSetupProgress(org(), NONE))).toBe(true);
		const draft = { id: 'e', name: 'X' };
		const p = buildSetupProgress(org(), { eventCount: 1, publishedCount: 0, latestDraft: draft });
		expect(shouldShowSetupCard(p)).toBe(true);
	});
});

describe('buildSetupProgress tax details', () => {
	const connected = {
		stripe_account_id: 'acct_1',
		stripe_charges_enabled: true,
		is_stripe_connected: true
	};
	it('needs-billing when charges enabled, fees apply and billing_name is missing', () => {
		const p = buildSetupProgress(
			org({ ...connected, platform_fee_percent: '2.5', billing_name: '' }),
			NONE
		);
		expect(p.stripe).toBe('needs-billing');
		expect(p.doneCount).toBe(1);
	});
	it('never needs-billing without a Stripe account', () => {
		const p = buildSetupProgress(
			org({ platform_fee_percent: '2.5', billing_name: '', billing_address: '' }),
			NONE
		);
		expect(p.stripe).toBe('none');
	});
	it('ready when there are no platform fees', () => {
		expect(buildSetupProgress(org({ ...connected, billing_name: '' }), NONE).stripe).toBe('ready');
	});
	it('ready when billing is complete', () => {
		expect(
			buildSetupProgress(org({ ...connected, platform_fee_percent: '2.5' }), NONE).stripe
		).toBe('ready');
	});
});

describe('billingNeedsAttention', () => {
	const base = {
		is_stripe_connected: true,
		platform_fee_percent: '2.5',
		platform_fee_fixed: '0',
		vat_country_code: 'IT',
		billing_address: 'Via Roma 1',
		billing_name: 'Acme'
	};
	it('is false when details are complete', () => {
		expect(billingNeedsAttention(base)).toBe(false);
	});
	it('is true when a field is missing', () => {
		expect(billingNeedsAttention({ ...base, billing_name: '' })).toBe(true);
		expect(billingNeedsAttention({ ...base, vat_country_code: '' })).toBe(true);
		expect(billingNeedsAttention({ ...base, billing_address: '' })).toBe(true);
	});
	it('is false without stripe or without fees', () => {
		expect(billingNeedsAttention({ ...base, billing_name: '', is_stripe_connected: false })).toBe(
			false
		);
		expect(
			billingNeedsAttention({
				...base,
				billing_name: '',
				platform_fee_percent: '0',
				platform_fee_fixed: '0.00'
			})
		).toBe(false);
	});
	it('is true with only a fixed fee', () => {
		expect(
			billingNeedsAttention({
				...base,
				billing_name: '',
				platform_fee_percent: '0',
				platform_fee_fixed: '0.30'
			})
		).toBe(true);
	});
});
