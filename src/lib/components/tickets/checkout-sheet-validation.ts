/**
 * Pure submit-gate for `CheckoutSheet` (#853 PR 2): checks every cart group's
 * ticket-name and PWYC-amount requirements and reports the FIRST offending
 * rule, in group order. No runes here — plain function so this stays
 * unit-testable without mounting the sheet.
 */
import type { CartGroup } from './cart.svelte';
import { pwycBounds, validatePwycAmount } from './pwyc-validation';

export type SheetValidationError = 'names' | 'pwyc';

/**
 * `null` means every group is ready to submit. `'names'` means some ticket in
 * some group is missing a (non-blank) holder name — only checked when
 * `requireTicketNames` is true. `'pwyc'` means some PWYC group's entered
 * amount fails `validatePwycAmount` against that tier's bounds.
 */
export function sheetValidationError(
	groups: readonly CartGroup[],
	requireTicketNames: boolean
): SheetValidationError | null {
	for (const group of groups) {
		if (requireTicketNames) {
			for (let index = 0; index < group.quantity; index++) {
				const name = group.guestNames[index] ?? '';
				if (!name.trim()) return 'names';
			}
		}
		if (group.tier.price_type === 'pwyc') {
			const { minAmount, maxAmount } = pwycBounds(group.tier);
			const validation = validatePwycAmount(group.pwycAmount ?? '', minAmount, maxAmount);
			if (!validation.valid) return 'pwyc';
		}
	}
	return null;
}
