/**
 * Pure PWYC amount validation for the purchase dialogs.
 *
 * No runes here — plain functions so this stays unit-testable.
 */
import * as m from '$lib/paraglide/messages.js';

export type PwycValidationError = 'empty' | 'invalid' | 'below_min' | 'above_max';

export interface PwycValidation {
	valid: boolean;
	error: PwycValidationError | null;
}

export function validatePwycAmount(
	raw: string,
	minAmount: number,
	maxAmount: number | null
): PwycValidation {
	const trimmed = raw.trim();
	if (!trimmed) return { valid: false, error: 'empty' };
	const value = parseFloat(trimmed);
	if (isNaN(value)) return { valid: false, error: 'invalid' };
	if (value < minAmount) return { valid: false, error: 'below_min' };
	if (maxAmount !== null && value > maxAmount) return { valid: false, error: 'above_max' };
	return { valid: true, error: null };
}

/** Quick-amount suggestions: min/midpoint/max, or min multiples when uncapped. */
export function pwycSuggestions(minAmount: number, maxAmount: number | null): number[] {
	if (maxAmount !== null) {
		return [minAmount, Math.round((minAmount + maxAmount) / 2), maxAmount];
	}
	return [minAmount, minAmount * 2, minAmount * 3];
}

/** Localized inline error for an invalid PWYC amount. */
export function pwycErrorMessage(
	error: PwycValidationError | null,
	currency: string,
	minAmount: number,
	maxAmount: number | null
): string {
	switch (error) {
		case 'empty':
			return m['ticketConfirmationDialog.errorEnterAmount']();
		case 'invalid':
			return m['ticketConfirmationDialog.errorValidNumber']();
		case 'below_min':
			return m['ticketConfirmationDialog.errorMinAmount']({
				amount: `${currency} ${minAmount.toFixed(2)}`
			});
		case 'above_max':
			return m['ticketConfirmationDialog.errorMaxAmount']({
				amount: `${currency} ${maxAmount?.toFixed(2)}`
			});
		default:
			return m['ticketConfirmationDialog.errorInvalidAmount']();
	}
}
