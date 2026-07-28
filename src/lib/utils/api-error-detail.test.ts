import { describe, it, expect } from 'vitest';
import { backendMessage, extractApiErrorDetail } from './api-error-detail';

describe('backendMessage', () => {
	it('returns message when the body carries a Ninja hard-block message', () => {
		expect(backendMessage({ message: 'Cannot cancel a completed application.' })).toBe(
			'Cannot cancel a completed application.'
		);
	});

	it('prefers message over detail when both are present', () => {
		expect(backendMessage({ message: 'from-message', detail: 'from-detail' })).toBe('from-message');
	});

	it('falls back to a DRF-style string detail', () => {
		expect(backendMessage({ detail: 'Not found.' })).toBe('Not found.');
	});

	it('returns null for empty strings, non-string fields, non-objects, and null', () => {
		expect(backendMessage({ message: '' })).toBeNull();
		expect(backendMessage({ message: 42 })).toBeNull();
		expect(backendMessage({ detail: ['pydantic-list-shape-is-not-handled-here'] })).toBeNull();
		expect(backendMessage('a string')).toBeNull();
		expect(backendMessage(null)).toBeNull();
		expect(backendMessage(undefined)).toBeNull();
	});
});

describe('extractApiErrorDetail (existing behavior untouched)', () => {
	it('still reads a plain string detail', () => {
		expect(extractApiErrorDetail({ detail: 'boom' })).toBe('boom');
	});
});
