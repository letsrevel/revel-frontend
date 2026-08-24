/**
 * Guest buyer identity for the cart checkout sheet (#853 PR 4): the email
 * (and, for events with `require_ticket_names` on, first/last name) an
 * unauthenticated buyer supplies for a purchase. Lives for the sheet's
 * lifetime — the host (`+page.svelte`, Task 5) owns the instance. `clear()`
 * is called only on login mid-cart, NOT after a successful guest purchase —
 * that's deliberate, so a guest who buys again doesn't have to retype their
 * details.
 *
 * Trim-on-write: every setter trims leading/trailing whitespace immediately,
 * so `identity.email`/`firstName`/`lastName` are ALWAYS already-trimmed by
 * the time any reader (the validator below, `buildGuestCartCheckoutParams`)
 * sees them — one flat property instead of a raw/trimmed pair. This mirrors
 * the discount-code input's existing live oninput transform
 * (`CheckoutSheet.svelte` strips non-alphanumerics and uppercases on every
 * keystroke) — the same codebase already accepts synchronous live transforms
 * on bound text inputs. Known trade-off: typing a trailing space mid-name
 * (e.g. "Mary Jane", captured the instant after the space keystroke) gets
 * stripped as soon as it's typed, same class of quirk as the discount input.
 * Accepted here since buyer-identity fields are normally filled by
 * paste-and-go or single-word entry.
 */
import { guestEmailOnlySchema } from '$lib/schemas/guestAttendance';

export class GuestIdentity {
	#email = $state('');
	#firstName = $state('');
	#lastName = $state('');

	get email(): string {
		return this.#email;
	}
	set email(value: string) {
		this.#email = value.trim();
	}

	get firstName(): string {
		return this.#firstName;
	}
	set firstName(value: string) {
		this.#firstName = value.trim();
	}

	get lastName(): string {
		return this.#lastName;
	}
	set lastName(value: string) {
		this.#lastName = value.trim();
	}

	/** Reset every field to empty — called on login mid-cart only (NOT after a
	 * successful guest purchase; see the class doc). */
	clear(): void {
		this.#email = '';
		this.#firstName = '';
		this.#lastName = '';
	}
}

export type GuestIdentityError = 'email' | 'names' | null;

/**
 * Pure submit-gate for the guest identity block, mirroring
 * `checkout-sheet-validation.ts`'s `sheetValidationError` shape (no runes,
 * unit-testable without mounting anything). Email is checked first — an
 * invalid/missing email always wins over missing names, matching the field
 * order in `GuestIdentityFields`. `requireNames` mirrors the sheet's
 * `requireTicketNames`: names are only ever collected (and only ever
 * required) when the event needs them on the ticket.
 */
export function guestIdentityError(
	identity: GuestIdentity,
	requireNames: boolean
): GuestIdentityError {
	if (!guestEmailOnlySchema.safeParse({ email: identity.email }).success) return 'email';
	if (requireNames && (!identity.firstName || !identity.lastName)) return 'names';
	return null;
}
