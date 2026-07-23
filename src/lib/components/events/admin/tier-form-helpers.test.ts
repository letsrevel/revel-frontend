import { describe, it, expect } from 'vitest';
import { isBillingInfoRequiredError } from './tier-form-helpers';

// The backend localizes organizer-facing validation messages per
// Accept-Language (BE #724): matching only the English text would silently
// drop the "complete billing settings" shortcut for it/de/fr organizers.
describe('isBillingInfoRequiredError', () => {
	it('matches the billing-required message in every backend locale', () => {
		expect(
			isBillingInfoRequiredError(
				'Billing information is required for online ticket sales with platform fees.'
			)
		).toBe(true);
		expect(
			isBillingInfoRequiredError(
				'Le informazioni di fatturazione sono necessarie per la vendita di biglietti online.'
			)
		).toBe(true);
		expect(
			isBillingInfoRequiredError(
				'Rechnungsinformationen sind für den Online-Ticketverkauf mit Plattformgebühren erforderlich.'
			)
		).toBe(true);
		expect(
			isBillingInfoRequiredError(
				'Les informations de facturation sont requises pour les ventes de tickets en ligne.'
			)
		).toBe(true);
	});

	it('does not match unrelated errors', () => {
		expect(isBillingInfoRequiredError('A sector is required for best-available seating.')).toBe(
			false
		);
		expect(isBillingInfoRequiredError('')).toBe(false);
	});
});
