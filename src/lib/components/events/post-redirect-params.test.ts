import { describe, it, expect, beforeEach } from 'vitest';
import { consumePostRedirectParams } from './post-redirect-params';

// The event page bounces back from Stripe / RSVP / guest-ticket flows with
// query params it must read exactly once and then scrub from the URL. jsdom
// gives us a real `window.location`/`window.history`, so we seed the URL via
// `history.pushState` (navigation, doesn't reload) rather than mocking.

function seedUrl(search: string) {
	window.history.pushState({}, '', `/events/acme/party${search}`);
}

describe('consumePostRedirectParams', () => {
	beforeEach(() => {
		seedUrl('');
	});

	it('preserves the URL hash when stripping params (#863 review)', () => {
		seedUrl('?payment_success=true&foo=1#ticket-tiers');
		const result = consumePostRedirectParams();
		expect(result.paymentSuccess).toBe(true);
		expect(window.location.search).toBe('?foo=1');
		expect(window.location.hash).toBe('#ticket-tiers');
	});

	it('returns all-false/null defaults when there are no params', () => {
		expect(consumePostRedirectParams()).toEqual({
			paymentSuccess: false,
			paymentCancelled: false,
			rsvpConfirmed: null,
			ticketConfirmed: false,
			discountCode: ''
		});
		// Nothing to strip — no history mutation, URL unchanged.
		expect(window.location.search).toBe('');
	});

	it('reads payment_success=true and strips it', () => {
		seedUrl('?payment_success=true');
		const result = consumePostRedirectParams();
		expect(result.paymentSuccess).toBe(true);
		expect(window.location.search).toBe('');
	});

	it('ignores a non-"true" payment_success value and leaves it in the URL', () => {
		seedUrl('?payment_success=maybe');
		const result = consumePostRedirectParams();
		expect(result.paymentSuccess).toBe(false);
		expect(window.location.search).toBe('?payment_success=maybe');
	});

	it('reads payment_cancelled=true and strips it', () => {
		seedUrl('?payment_cancelled=true');
		const result = consumePostRedirectParams();
		expect(result.paymentCancelled).toBe(true);
		expect(window.location.search).toBe('');
	});

	it('reads a valid rsvp value and strips it', () => {
		for (const status of ['yes', 'no', 'maybe']) {
			seedUrl(`?rsvp=${status}`);
			const result = consumePostRedirectParams();
			expect(result.rsvpConfirmed).toBe(status);
			expect(window.location.search).toBe('');
		}
	});

	it('rejects an invalid rsvp value and leaves it in the URL', () => {
		seedUrl('?rsvp=nope');
		const result = consumePostRedirectParams();
		expect(result.rsvpConfirmed).toBeNull();
		expect(window.location.search).toBe('?rsvp=nope');
	});

	it('reads a truthy ticket_id and strips it', () => {
		seedUrl('?ticket_id=abc-123');
		const result = consumePostRedirectParams();
		expect(result.ticketConfirmed).toBe(true);
		expect(window.location.search).toBe('');
	});

	it('does not confirm on an empty ticket_id and leaves it in the URL', () => {
		seedUrl('?ticket_id=');
		const result = consumePostRedirectParams();
		expect(result.ticketConfirmed).toBe(false);
		expect(window.location.search).toBe('?ticket_id=');
	});

	it('uppercases the discount code and strips the param', () => {
		seedUrl('?discount=save10');
		const result = consumePostRedirectParams();
		expect(result.discountCode).toBe('SAVE10');
		expect(window.location.search).toBe('');
	});

	it('strips only the params it recognizes, preserving unrelated ones', () => {
		seedUrl('?payment_success=true&utm_source=newsletter&discount=vip');
		const result = consumePostRedirectParams();
		expect(result.paymentSuccess).toBe(true);
		expect(result.discountCode).toBe('VIP');
		expect(window.location.search).toBe('?utm_source=newsletter');
	});

	it('strips every handled param in a single pass, all flags reported together', () => {
		seedUrl('?payment_success=true&rsvp=yes&ticket_id=t-1&discount=hello');
		const result = consumePostRedirectParams();
		expect(result).toEqual({
			paymentSuccess: true,
			paymentCancelled: false,
			rsvpConfirmed: 'yes',
			ticketConfirmed: true,
			discountCode: 'HELLO'
		});
		expect(window.location.search).toBe('');
	});
});
