import { describe, it, expect } from 'vitest';
import {
	tierOnlineWithoutStripe,
	tierFreeWithPrice,
	tierPublicButRestricted,
	tierOfflineWithoutInstructions
} from './tier';

describe('D1 tierOnlineWithoutStripe', () => {
	it('warns for an online tier without Stripe', () => {
		const w = tierOnlineWithoutStripe({
			payment_method: 'online',
			organizationStripeConnected: false
		});
		expect(w?.id).toBe('D1');
		expect(w?.level).toBe('warn');
		expect(w?.title()).toBe('Online payments are not set up');
		expect(w?.message()).toContain('no connected Stripe account');
		expect(w?.fixTarget).toBeUndefined();
	});
	it('is silent when Stripe is connected', () => {
		expect(
			tierOnlineWithoutStripe({ payment_method: 'online', organizationStripeConnected: true })
		).toBeNull();
	});
	it('is silent for other payment methods', () => {
		expect(
			tierOnlineWithoutStripe({ payment_method: 'offline', organizationStripeConnected: false })
		).toBeNull();
	});
});

describe('D2 tierFreeWithPrice', () => {
	it('warns for a free tier with a string price', () => {
		const w = tierFreeWithPrice({ payment_method: 'free', price: '10.00' });
		expect(w?.id).toBe('D2');
		expect(w?.level).toBe('warn');
		expect(w?.title()).toBe('Free tier has a price');
		expect(w?.message()).toContain('price is above zero');
	});
	it('warns for a numeric price', () => {
		expect(tierFreeWithPrice({ payment_method: 'free', price: 5 })).not.toBeNull();
	});
	it('is silent for a zero, empty, null or invalid price', () => {
		for (const price of ['0', '0.00', 0, '', null, undefined, 'abc']) {
			expect(tierFreeWithPrice({ payment_method: 'free', price })).toBeNull();
		}
	});
	it('is silent for a paid method', () => {
		expect(tierFreeWithPrice({ payment_method: 'online', price: '10' })).toBeNull();
	});
});

describe('D3 tierPublicButRestricted', () => {
	it.each(['invited', 'members', 'invited_and_members'])('fires for public + %s', (by) => {
		const w = tierPublicButRestricted({ visibility: 'public', purchasable_by: by });
		expect(w?.id).toBe('D3');
		expect(w?.level).toBe('info');
		expect(w?.title()).toBe('Public tier that most people cannot buy');
		expect(w?.message()).toContain('only invited guests or members');
	});
	it.each(['public', 'non_members', '', null])('is silent for purchasable_by %s', (by) => {
		expect(tierPublicButRestricted({ visibility: 'public', purchasable_by: by })).toBeNull();
	});
	it('is silent when the tier is not public', () => {
		expect(
			tierPublicButRestricted({ visibility: 'members-only', purchasable_by: 'members' })
		).toBeNull();
	});
});

describe('D4 tierOfflineWithoutInstructions', () => {
	it.each(['', '   \n', null, undefined])('fires for offline + %j', (text) => {
		const w = tierOfflineWithoutInstructions({
			payment_method: 'offline',
			manual_payment_instructions: text
		});
		expect(w?.id).toBe('D4');
		expect(w?.level).toBe('info');
		expect(w?.title()).toBe('No payment instructions');
		expect(w?.message()).toContain('Add the payment instructions');
	});
	it('is silent when instructions exist', () => {
		expect(
			tierOfflineWithoutInstructions({
				payment_method: 'offline',
				manual_payment_instructions: 'Send cash'
			})
		).toBeNull();
	});
	it('is silent for at_the_door', () => {
		expect(
			tierOfflineWithoutInstructions({
				payment_method: 'at_the_door',
				manual_payment_instructions: ''
			})
		).toBeNull();
	});
});
