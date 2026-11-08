import type {
	MembershipRecordCreateSchema,
	MembershipRecordEndedReason,
	MembershipRecordSchema
} from '$lib/api/generated/types.gen';
import type { RecordEditability } from './editability';

/** Max length of `full_name` on the backend. */
export const FULL_NAME_MAX = 255;

/** Form state. Dates are `<input type="datetime-local">` strings (local wall time). */
export interface RecordFormValues {
	fullName: string;
	email: string;
	tierId: string;
	validFrom: string;
	validUntil: string;
}

export const EMPTY_FORM: RecordFormValues = {
	fullName: '',
	email: '',
	tierId: '',
	validFrom: '',
	validUntil: ''
};

const pad = (n: number): string => String(n).padStart(2, '0');

/** ISO instant -> `YYYY-MM-DDTHH:mm` in the browser's local time ('' for empty/invalid). */
export function isoToLocalInput(iso: string | null | undefined): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * `datetime-local` value -> ISO 8601 instant. The input holds the staff member's
 * local wall time, so this is the honest instant for that wall time (`Date`
 * parses a zone-less datetime string as local). Returns null for empty/invalid.
 */
export function localInputToIso(local: string | null | undefined): string | null {
	if (!local) return null;
	const d = new Date(local);
	return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formValuesFromRecord(record: MembershipRecordSchema): RecordFormValues {
	return {
		fullName: record.full_name,
		email: record.email ?? '',
		tierId: record.tier_id ?? '',
		validFrom: isoToLocalInput(record.valid_from),
		validUntil: isoToLocalInput(record.valid_until)
	};
}

export type FormErrorCode =
	| 'nameRequired'
	| 'nameTooLong'
	| 'emailInvalid'
	| 'tierRequired'
	| 'validFromRequired'
	| 'validFromFuture'
	| 'rangeInvalid';

export type FormErrors = Partial<
	Record<'fullName' | 'email' | 'tierId' | 'validFrom' | 'validUntil', FormErrorCode>
>;

// Deliberately loose: the server is the authority (EmailStr); this only catches typos.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRecordForm(
	values: RecordFormValues,
	opts: { mode: 'create' | 'edit'; editability?: RecordEditability; now?: Date }
): FormErrors {
	const errors: FormErrors = {};
	const name = values.fullName.trim();
	if (!name) errors.fullName = 'nameRequired';
	else if (name.length > FULL_NAME_MAX) errors.fullName = 'nameTooLong';

	const email = values.email.trim();
	if (email && !EMAIL_RE.test(email)) errors.email = 'emailInvalid';

	if (opts.mode === 'create' && !values.tierId) errors.tierId = 'tierRequired';

	const from = localInputToIso(values.validFrom);
	if (!from) errors.validFrom = 'validFromRequired';
	else if (opts.editability?.validFromNotFuture && new Date(from) > (opts.now ?? new Date())) {
		errors.validFrom = 'validFromFuture';
	}

	const until = localInputToIso(values.validUntil);
	if (from && until && new Date(until) < new Date(from)) errors.validUntil = 'rangeInvalid';
	return errors;
}

/** Body of `POST /member-register`. `valid_until` is omitted rather than sent as null. */
export function buildCreateBody(values: RecordFormValues): MembershipRecordCreateSchema {
	const body: MembershipRecordCreateSchema = {
		full_name: values.fullName.trim(),
		tier_id: values.tierId,
		valid_from: localInputToIso(values.validFrom) ?? ''
	};
	const email = values.email.trim();
	if (email) body.email = email;
	const until = localInputToIso(values.validUntil);
	if (until) body.valid_until = until;
	return body;
}

/**
 * Body of `PATCH /member-register/{id}`. The backend rejects an explicit null
 * for `full_name`, `tier_id` and `valid_from`, so those keys are typed
 * non-nullable and only ever present with a value. Only CHANGED fields are
 * sent, and fields locked by the linked/unlinked rules are never sent (a
 * `tier_id` or `valid_until` on a linked open entry is a 409).
 */
export interface RecordUpdateBody {
	full_name?: string;
	email?: string | null;
	tier_id?: string;
	valid_from?: string;
	valid_until?: string | null;
}

export function buildUpdateBody(
	original: RecordFormValues,
	current: RecordFormValues,
	editability: RecordEditability
): RecordUpdateBody {
	const body: RecordUpdateBody = {};
	const name = current.fullName.trim();
	if (name && name !== original.fullName.trim()) body.full_name = name;

	const email = current.email.trim();
	if (email !== original.email.trim()) body.email = email || null;

	if (!editability.tierLocked && current.tierId && current.tierId !== original.tierId) {
		body.tier_id = current.tierId;
	}

	// Compare the input strings, not instants: seconds are not representable in the input,
	// so an untouched field must not be re-sent (and silently truncated).
	if (current.validFrom && current.validFrom !== original.validFrom) {
		const iso = localInputToIso(current.validFrom);
		if (iso) body.valid_from = iso;
	}

	if (!editability.validUntilLocked && current.validUntil !== original.validUntil) {
		if (current.validUntil) {
			const iso = localInputToIso(current.validUntil);
			if (iso) body.valid_until = iso;
		} else if (!editability.reopenBlocked) {
			body.valid_until = null;
		}
	}
	return body;
}

export interface EndFormValues {
	reason: Extract<MembershipRecordEndedReason, 'cancelled' | 'removed'>;
	/** datetime-local; '' = now (server default). */
	validUntil: string;
}

export interface EndBody {
	reason: EndFormValues['reason'];
	valid_until?: string;
}

export function buildEndBody(values: EndFormValues): EndBody {
	const body: EndBody = { reason: values.reason };
	const until = localInputToIso(values.validUntil);
	if (until) body.valid_until = until;
	return body;
}

export type EndErrorCode = 'beforeStart' | 'future';

export function validateEndForm(
	values: EndFormValues,
	record: Pick<MembershipRecordSchema, 'valid_from'>,
	opts: { linked: boolean; now?: Date }
): EndErrorCode | null {
	const until = localInputToIso(values.validUntil);
	if (!until) return null;
	if (new Date(until) < new Date(record.valid_from)) return 'beforeStart';
	if (opts.linked && new Date(until) > (opts.now ?? new Date())) return 'future';
	return null;
}
