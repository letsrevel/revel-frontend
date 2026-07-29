import { describe, it, expect } from 'vitest';
import {
	backendMessage,
	extractApiErrorDetail,
	extractValidationErrors,
	isErrorDetail,
	isRequestValidationError,
	isResponseMessage,
	isValidationErrorResponse
} from './api-error-detail';

// django-ninja's request-validation 422: `detail` is a LIST of objects, not a
// string. Typing it as ErrorDetail would be actively wrong (backend #826).
const REQUEST_VALIDATION_422 = {
	detail: [
		{ type: 'greater_than_equal', loc: ['body', 'payload', 'amount'], msg: 'Input should be >= 0' },
		{ type: 'missing', loc: ['body', 'payload', 'currency'], msg: 'Field required' }
	]
};

describe('isErrorDetail', () => {
	it('accepts the { detail: string } domain-refusal body', () => {
		expect(isErrorDetail({ detail: 'Ticket tiers not found: abc, def' })).toBe(true);
	});

	it('rejects the 422 list shape, which is a different schema sharing the key', () => {
		expect(isErrorDetail(REQUEST_VALIDATION_422)).toBe(false);
	});

	it('rejects blank details, other shapes, and non-objects', () => {
		expect(isErrorDetail({ detail: '   ' })).toBe(false);
		expect(isErrorDetail({ errors: { name: ['required'] } })).toBe(false);
		expect(isErrorDetail({ message: 'nope' })).toBe(false);
		expect(isErrorDetail('a string')).toBe(false);
		expect(isErrorDetail(null)).toBe(false);
		expect(isErrorDetail(undefined)).toBe(false);
		expect(isErrorDetail([{ detail: 'x' }])).toBe(false);
	});
});

describe('isRequestValidationError', () => {
	it('accepts a 422 whose detail is a list of { msg } entries', () => {
		expect(isRequestValidationError(REQUEST_VALIDATION_422)).toBe(true);
	});

	it('rejects a string detail and a list with no readable msg', () => {
		expect(isRequestValidationError({ detail: 'plain string' })).toBe(false);
		expect(isRequestValidationError({ detail: [] })).toBe(false);
		expect(isRequestValidationError({ detail: ['just-a-string'] })).toBe(false);
		expect(isRequestValidationError(null)).toBe(false);
	});

	it('rejects a MIXED list — the predicate promises every entry is readable', () => {
		expect(isRequestValidationError({ detail: [{ msg: 'Field required' }, 'not-an-object'] })).toBe(
			false
		);
		expect(isRequestValidationError({ detail: [{ msg: 'Field required' }, { type: 'x' }] })).toBe(
			false
		);
	});
});

describe('isValidationErrorResponse', () => {
	it('accepts array-valued and string-valued field errors', () => {
		expect(isValidationErrorResponse({ errors: { name: ['This field is required.'] } })).toBe(true);
		expect(isValidationErrorResponse({ errors: { name: 'This field is required.' } })).toBe(true);
	});

	it('rejects empty error maps and the other shapes', () => {
		expect(isValidationErrorResponse({ errors: {} })).toBe(false);
		expect(isValidationErrorResponse({ errors: { name: [] } })).toBe(false);
		expect(isValidationErrorResponse({ detail: 'boom' })).toBe(false);
		expect(isValidationErrorResponse(undefined)).toBe(false);
	});
});

describe('isResponseMessage', () => {
	it('accepts { message: string } — genuine on the two claim-invitation endpoints', () => {
		expect(isResponseMessage({ message: 'This invitation has already been claimed.' })).toBe(true);
	});

	it('rejects blanks, non-strings and the other shapes', () => {
		expect(isResponseMessage({ message: '' })).toBe(false);
		expect(isResponseMessage({ message: 42 })).toBe(false);
		expect(isResponseMessage({ detail: 'boom' })).toBe(false);
		expect(isResponseMessage(null)).toBe(false);
	});
});

describe('extractApiErrorDetail', () => {
	it('reads a plain string detail', () => {
		expect(extractApiErrorDetail({ detail: 'boom' })).toBe('boom');
	});

	it('flattens the 422 detail LIST instead of stringifying it', () => {
		expect(extractApiErrorDetail(REQUEST_VALIDATION_422)).toBe(
			'Input should be >= 0, Field required'
		);
	});

	it('returns null when nothing readable is present', () => {
		expect(extractApiErrorDetail({ errors: { name: ['x'] } })).toBeNull();
		expect(extractApiErrorDetail({ detail: '' })).toBeNull();
		expect(extractApiErrorDetail(null)).toBeNull();
	});
});

describe('extractValidationErrors', () => {
	it('flattens array-valued and string-valued field errors', () => {
		expect(
			extractValidationErrors({ errors: { name: ['Too long.'], price: 'Must be positive.' } })
		).toBe('Too long. Must be positive.');
	});

	it('returns null for the other shapes', () => {
		expect(extractValidationErrors({ detail: 'boom' })).toBeNull();
		expect(extractValidationErrors(null)).toBeNull();
	});
});

describe('backendMessage', () => {
	it('prefers detail over message — `message` was the lying declaration (#824)', () => {
		expect(backendMessage({ message: 'from-message', detail: 'from-detail' })).toBe('from-detail');
	});

	it('still reads message when it is the only shape present', () => {
		expect(backendMessage({ message: 'Cannot cancel a completed application.' })).toBe(
			'Cannot cancel a completed application.'
		);
	});

	it('reads a string detail', () => {
		expect(backendMessage({ detail: 'Not found.' })).toBe('Not found.');
	});

	it('reads the 422 detail list rather than falling through to generic copy', () => {
		expect(backendMessage(REQUEST_VALIDATION_422)).toBe('Input should be >= 0, Field required');
	});

	it('reads a ValidationErrorResponse when that is the union branch that arrived', () => {
		expect(backendMessage({ errors: { amount: ['Ensure this value is greater than 0.'] } })).toBe(
			'Ensure this value is greater than 0.'
		);
	});

	it('returns null for empty strings, non-string fields, non-objects, and null', () => {
		expect(backendMessage({ message: '' })).toBeNull();
		expect(backendMessage({ message: 42 })).toBeNull();
		expect(backendMessage({ detail: [] })).toBeNull();
		expect(backendMessage('a string')).toBeNull();
		expect(backendMessage(null)).toBeNull();
		expect(backendMessage(undefined)).toBeNull();
	});
});
