import {
	organizationadminmemberregisterCreateMemberRegisterRecord,
	organizationadminmemberregisterDeleteMemberRegisterRecord,
	organizationadminmemberregisterEndMemberRegisterRecord,
	organizationadminmemberregisterExportMemberRegister,
	organizationadminmemberregisterListMemberRegister,
	organizationadminmemberregisterUpdateMemberRegisterRecord
} from '$lib/api';
import type {
	MembershipRecordCreateSchema,
	MembershipRecordSchema,
	PaginatedResponseSchemaMembershipRecordSchema
} from '$lib/api/generated/types.gen';
import { backendMessage } from '$lib/utils/api-error-detail';
import { filtersToQuery, type RegisterFilters } from './filters';
import type { EndBody, RecordUpdateBody } from './form-values';

/**
 * Failure of a register call. Carries the HTTP status (the generated client's
 * `error` is only the body) so dialogs can tell a stale-state 409 from a
 * validation 400. `body` is the untouched `res.error`.
 *
 * `silent`: the dialogs render these inline, so the global mutation toast
 * ("Action failed") would be a duplicate.
 */
export class RegisterApiError extends Error {
	readonly status: number;
	readonly body: unknown;
	readonly silent = true;

	constructor(status: number, body: unknown) {
		super(backendMessage(body) ?? `Member register request failed (${status})`);
		this.name = 'RegisterApiError';
		this.status = status;
		this.body = body;
	}
}

interface Settled {
	error?: unknown;
	response?: { status?: number };
}

function ensureOk(res: Settled): void {
	if (res.error) throw new RegisterApiError(res.response?.status ?? 0, res.error);
}

function authHeaders(accessToken: string | null | undefined): { Authorization: string } {
	// Fail clearly instead of sending `Bearer undefined` and surfacing a confusing 401.
	if (!accessToken) throw new Error('member-register: missing access token');
	return { Authorization: `Bearer ${accessToken}` };
}

export const memberRegisterKeys = {
	/** Prefix of everything register-related; invalidate after any write. */
	all: (slug: string) => ['organization', slug, 'member-register'] as const,
	list: (slug: string, filters: RegisterFilters) =>
		['organization', slug, 'member-register', 'list', filters] as const
};

export async function listRegister(
	slug: string,
	accessToken: string | null | undefined,
	filters: RegisterFilters
): Promise<PaginatedResponseSchemaMembershipRecordSchema> {
	const res = await organizationadminmemberregisterListMemberRegister({
		path: { slug },
		query: filtersToQuery(filters),
		headers: authHeaders(accessToken)
	});
	ensureOk(res);
	if (!res.data) throw new RegisterApiError(res.response?.status ?? 0, null);
	return res.data;
}

export async function createRecord(
	slug: string,
	accessToken: string | null | undefined,
	body: MembershipRecordCreateSchema
): Promise<MembershipRecordSchema> {
	const res = await organizationadminmemberregisterCreateMemberRegisterRecord({
		path: { slug },
		body,
		headers: authHeaders(accessToken)
	});
	ensureOk(res);
	if (!res.data) throw new RegisterApiError(res.response?.status ?? 0, null);
	return res.data;
}

export async function updateRecord(
	slug: string,
	accessToken: string | null | undefined,
	recordId: string,
	body: RecordUpdateBody
): Promise<MembershipRecordSchema> {
	const res = await organizationadminmemberregisterUpdateMemberRegisterRecord({
		path: { slug, record_id: recordId },
		body,
		headers: authHeaders(accessToken)
	});
	ensureOk(res);
	if (!res.data) throw new RegisterApiError(res.response?.status ?? 0, null);
	return res.data;
}

export async function endRecord(
	slug: string,
	accessToken: string | null | undefined,
	recordId: string,
	body: EndBody
): Promise<MembershipRecordSchema> {
	const res = await organizationadminmemberregisterEndMemberRegisterRecord({
		path: { slug, record_id: recordId },
		body,
		headers: authHeaders(accessToken)
	});
	ensureOk(res);
	if (!res.data) throw new RegisterApiError(res.response?.status ?? 0, null);
	return res.data;
}

export async function deleteRecord(
	slug: string,
	accessToken: string | null | undefined,
	recordId: string
): Promise<void> {
	const res = await organizationadminmemberregisterDeleteMemberRegisterRecord({
		path: { slug, record_id: recordId },
		headers: authHeaders(accessToken)
	});
	ensureOk(res);
}

/**
 * Start the xlsx export; resolves to the export id for the shared polling flow
 * (`ExportButton`). `activeOn` is the raw `YYYY-MM-DD` day (org timezone).
 */
export async function startRegisterExport(
	slug: string,
	accessToken: string | null | undefined,
	activeOn: string | null
): Promise<string> {
	const res = await organizationadminmemberregisterExportMemberRegister({
		path: { slug },
		body: activeOn ? { active_on: activeOn } : {},
		headers: authHeaders(accessToken)
	});
	ensureOk(res);
	const id = res.data?.id;
	if (!id) throw new RegisterApiError(res.response?.status ?? 0, null);
	return id;
}
