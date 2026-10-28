import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import TicketingStep from './TicketingStep.svelte';
import { stashTierDraft, type TierDraft } from './tier-draft';

vi.mock('$lib/api/generated/sdk.gen', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/generated/sdk.gen')>()),
	eventadminticketsListTicketTiers: vi.fn(async () => ({
		data: { results: [] },
		error: undefined
	})),
	organizationadminmembersListMembershipTiers: vi.fn(async () => ({ data: [], error: undefined })),
	eventpublicdetailsGetEvent: vi.fn(async () => ({ data: undefined, error: {} }))
}));

const draft: TierDraft = {
	tierId: null,
	name: 'Early Bird',
	description: '',
	paymentMethod: 'online',
	priceType: 'fixed',
	price: '12.50',
	pwycMin: '1',
	pwycMax: '',
	currency: 'EUR',
	vatRateOverride: '',
	manualPaymentInstructions: '',
	totalQuantity: '',
	salesStartAt: '',
	salesEndAt: '',
	maxTicketsPerUser: '',
	visibility: 'public',
	purchasableBy: 'public'
};

function renderStep() {
	return render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: TicketingStep,
			componentProps: {
				eventId: 'e1',
				organizationSlug: 'acme',
				organizationStripeConnected: false,
				isOwner: true,
				formData: {},
				onUpdate: vi.fn(),
				onBack: vi.fn(),
				onNext: vi.fn()
			}
		}
	});
}

describe('TicketingStep: tier draft restore after Stripe', () => {
	beforeEach(() => sessionStorage.clear());
	afterEach(() => window.history.replaceState({}, '', '/'));

	it.each(['stripe_success=true', 'stripe_refresh=true'])(
		'?%s reopens the tier form prefilled and clears the stash',
		async (param) => {
			window.history.replaceState({}, '', `/x?tab=ticketing&${param}`);
			stashTierDraft('e1', draft);
			renderStep();
			expect(await screen.findByLabelText(/Tier Name/i)).toHaveValue('Early Bird');
			expect(screen.getByLabelText(/Payment Method/)).toHaveValue('online');
			expect(sessionStorage.getItem('revel:tier-draft:e1')).toBeNull();
		}
	);

	it('no Stripe param: the stash is left alone and no form opens', () => {
		window.history.replaceState({}, '', '/x?tab=ticketing');
		stashTierDraft('e1', draft);
		renderStep();
		expect(screen.queryByLabelText(/Tier Name/i)).toBeNull();
		expect(sessionStorage.getItem('revel:tier-draft:e1')).not.toBeNull();
	});

	it('corrupted stash is ignored', () => {
		window.history.replaceState({}, '', '/x?tab=ticketing&stripe_success=true');
		sessionStorage.setItem('revel:tier-draft:e1', '{oops');
		renderStep();
		expect(screen.queryByLabelText(/Tier Name/i)).toBeNull();
		expect(sessionStorage.getItem('revel:tier-draft:e1')).toBeNull();
	});
});
