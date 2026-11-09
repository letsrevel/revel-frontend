import type {
	MembershipRecordCreateSchema,
	MembershipRecordEndedReason,
	MembershipRecordEndSchema,
	MembershipRecordSchema,
	MembershipRecordUpdateSchema
} from '$lib/api/generated/types.gen';
import { toDateTimeLocal, toISOString } from '$lib/utils/datetime';
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

const LOCAL_INPUT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A date-only string (`YYYY-MM-DD`) means that day at 00:00 local: return the
 * conforming `YYYY-MM-DDT00:00`. Anything else is returned unchanged. Never feed
 * a non-conforming string to a datetime-local input (the browser warns and blanks it).
 */
export function normalizeLocalInput(value: string | null | undefined): string {
	const v = (value ?? '').trim();
	return DATE_ONLY_RE.test(v) ? `${v}T00:00` : v;
}

/**
 * `datetime-local` value (the browser's local wall time) -> ISO 8601 string with
 * that zone's offset, via the shared `toISOString`: an absolute instant, which
 * `new Date()` parses back exactly. Null for empty or malformed input (the
 * shared helper does not validate; a garbage string would reach the API).
 */
function toInstant(raw: string | null | undefined): string | null {
	const local = normalizeLocalInput(raw);
	if (!local || !LOCAL_INPUT_RE.test(local) || Number.isNaN(new Date(local).getTime())) return null;
	return toISOString(local);
}

export function formValuesFromRecord(record: MembershipRecordSchema): RecordFormValues {
	return {
		fullName: record.full_name,
		email: record.email ?? '',
		tierId: record.tier_id ?? '',
		validFrom: toDateTimeLocal(record.valid_from),
		validUntil: toDateTimeLocal(record.valid_until)
	};
}

export type FormErrorCode =
	| 'nameRequired'
	| 'nameTooLong'
	| 'emailInvalid'
	| 'tierRequired'
	| 'validFromRequired'
	| 'validFromFuture'
	| 'rangeInvalid'
	| 'noReopen';

export type FormErrors = Partial<
	Record<'fullName' | 'email' | 'tierId' | 'validFrom' | 'validUntil', FormErrorCode>
>;

// Deliberately loose: the server is the authority (EmailStr); this only catches typos.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRecordForm(
	values: RecordFormValues,
	opts: {
		mode: 'create' | 'edit';
		editability?: RecordEditability;
		/** Edit mode: the seeded values, so untouched fields are not re-validated (they are not sent). */
		original?: RecordFormValues;
		now?: Date;
	}
): FormErrors {
	const errors: FormErrors = {};
	const name = values.fullName.trim();
	if (!name) errors.fullName = 'nameRequired';
	else if (name.length > FULL_NAME_MAX) errors.fullName = 'nameTooLong';

	const email = values.email.trim();
	if (email && !EMAIL_RE.test(email)) errors.email = 'emailInvalid';

	if (opts.mode === 'create' && !values.tierId) errors.tierId = 'tierRequired';

	const from = toInstant(values.validFrom);
	if (!from) errors.validFrom = 'validFromRequired';
	else if (
		opts.editability?.validFromNotFuture &&
		// Only a changed valid_from is sent, so only a changed one is checked.
		(!opts.original || normalizeLocalInput(values.validFrom) !== opts.original.validFrom) &&
		new Date(from) > (opts.now ?? new Date())
	) {
		errors.validFrom = 'validFromFuture';
	}

	const until = toInstant(values.validUntil);
	if (from && until && new Date(until) < new Date(from)) errors.validUntil = 'rangeInvalid';
	// A closed linked entry can be re-dated but never reopened; clearing would be dropped silently.
	if (opts.editability?.reopenBlocked && !values.validUntil) errors.validUntil = 'noReopen';
	return errors;
}

/** Body of `POST /member-register`. `valid_until` is omitted rather than sent as null. */
export function buildCreateBody(values: RecordFormValues): MembershipRecordCreateSchema {
	const body: MembershipRecordCreateSchema = {
		full_name: values.fullName.trim(),
		tier_id: values.tierId,
		valid_from: toInstant(values.validFrom) ?? ''
	};
	const email = values.email.trim();
	if (email) body.email = email;
	const until = toInstant(values.validUntil);
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
export type RecordUpdateBody = Omit<
	MembershipRecordUpdateSchema,
	'full_name' | 'tier_id' | 'valid_from'
> &
	Partial<{
		[K in 'full_name' | 'tier_id' | 'valid_from']: NonNullable<MembershipRecordUpdateSchema[K]>;
	}>;

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
	if (current.validFrom && normalizeLocalInput(current.validFrom) !== original.validFrom) {
		const iso = toInstant(current.validFrom);
		if (iso) body.valid_from = iso;
	}

	if (!editability.validUntilLocked && current.validUntil !== original.validUntil) {
		if (current.validUntil) {
			const iso = toInstant(current.validUntil);
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

export type EndBody = Pick<MembershipRecordEndSchema, 'reason'> & { valid_until?: string };

export function buildEndBody(values: EndFormValues): EndBody {
	const body: EndBody = { reason: values.reason };
	const until = toInstant(values.validUntil);
	if (until) body.valid_until = until;
	return body;
}

export type EndErrorCode = 'beforeStart' | 'future';

export function validateEndForm(
	values: EndFormValues,
	record: Pick<MembershipRecordSchema, 'valid_from'>,
	opts: { linked: boolean; now?: Date }
): EndErrorCode | null {
	const until = toInstant(values.validUntil);
	if (!until) return null;
	if (new Date(until) < new Date(record.valid_from)) return 'beforeStart';
	if (opts.linked && new Date(until) > (opts.now ?? new Date())) return 'future';
	return null;
}

export type LockableField = 'tier' | 'validUntil';

/**
 * After a stale 409 and refetch: rebuild the form from the FRESH record, keeping
 * the user's edits only on fields that are still editable. A value typed into a
 * field that is now locked (or a cleared end date that can no longer be cleared)
 * is dropped, and reported so the caller can say so.
 */
export function reconcileAfterStale(
	original: RecordFormValues,
	current: RecordFormValues,
	fresh: RecordFormValues,
	editability: RecordEditability
): { values: RecordFormValues; dropped: LockableField[] } {
	const values: RecordFormValues = { ...fresh };
	const dropped: LockableField[] = [];
	if (current.fullName !== original.fullName) values.fullName = current.fullName;
	if (current.email !== original.email) values.email = current.email;
	if (current.validFrom !== original.validFrom) values.validFrom = current.validFrom;
	if (current.tierId !== original.tierId) {
		if (editability.tierLocked) dropped.push('tier');
		else values.tierId = current.tierId;
	}
	if (current.validUntil !== original.validUntil) {
		const clearingBlocked = editability.reopenBlocked && !current.validUntil;
		if (editability.validUntilLocked || clearingBlocked) dropped.push('validUntil');
		else values.validUntil = current.validUntil;
	}
	return { values, dropped };
}
