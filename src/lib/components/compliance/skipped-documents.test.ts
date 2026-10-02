import { describe, it, expect } from 'vitest';
import {
	kindLabel,
	resolveActionId,
	resolvedQueryParam,
	resolveErrorMessage
} from './skipped-documents';

describe('skipped-documents helpers', () => {
	it('maps the status filter to the resolved query param', () => {
		expect(resolvedQueryParam('open')).toBe(false);
		expect(resolvedQueryParam('done')).toBe(true);
		expect(resolvedQueryParam('all')).toBeUndefined();
	});

	it('labels the document kind', () => {
		expect(kindLabel('invoice')).toBe('Invoice');
		expect(kindLabel('credit_note')).toBe('Credit note');
	});

	it('builds a stable action id per document', () => {
		expect(resolveActionId('abc')).toBe('skipped-document-resolve-abc');
	});

	it("shows the API's detail, else the fallback", () => {
		expect(resolveErrorMessage({ detail: 'Reference too long.' })).toBe('Reference too long.');
		expect(resolveErrorMessage({ detail: [{ msg: 'Field required' }] })).toBe('Field required');
		expect(resolveErrorMessage({ detail: '  ' })).toBe("Couldn't save the document number.");
		expect(resolveErrorMessage(undefined)).toBe("Couldn't save the document number.");
	});
});
