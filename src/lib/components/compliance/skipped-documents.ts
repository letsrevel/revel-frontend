import * as m from '$lib/paraglide/messages.js';
import type { SkippedFiscalDocumentKind } from '$lib/api/generated/types.gen';

/** Invoices / credit notes Revel skipped under a country policy (#1008). */

export function kindLabel(kind: SkippedFiscalDocumentKind): string {
	return kind === 'credit_note'
		? m['compliance.skipped.kindCreditNote']()
		: m['compliance.skipped.kindInvoice']();
}

/** DOM id of a row's "Mark as issued" button, so focus can return to it. */
export function resolveActionId(documentId: string): string {
	return `skipped-document-resolve-${documentId}`;
}

/** Status filter of the list; the view opens on what's still to issue. */
export type SkippedStatusFilter = 'open' | 'done' | 'all';

export function resolvedQueryParam(filter: SkippedStatusFilter): boolean | undefined {
	if (filter === 'open') return false;
	if (filter === 'done') return true;
	return undefined;
}

/** The refusal text to show for a failed resolve: the API's `detail`, else the fallback. */
export function resolveErrorMessage(error: unknown): string {
	if (error && typeof error === 'object' && 'detail' in error) {
		const { detail } = error as { detail: unknown };
		if (typeof detail === 'string' && detail.trim()) return detail;
		// Ninja's validation 422 lists the field errors.
		if (Array.isArray(detail)) {
			const first = detail[0] as { msg?: unknown } | undefined;
			if (first && typeof first.msg === 'string' && first.msg.trim()) return first.msg;
		}
	}
	return m['compliance.skipped.saveFailed']();
}
