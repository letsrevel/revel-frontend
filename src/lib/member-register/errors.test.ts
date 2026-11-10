import { describe, expect, it } from 'vitest';
import { describeRegisterError } from './errors';
import { RegisterApiError } from './api';

describe('describeRegisterError 404', () => {
	it('keeps the stale register-entry copy for register actions', () => {
		const d = describeRegisterError(new RegisterApiError(404, null), 'save');
		expect(d.stale).toBe(true);
	});
	it('a lookup 404 is the generic error, never stale', () => {
		const d = describeRegisterError(new RegisterApiError(404, null), 'lookup');
		expect(d.stale).toBe(false);
		const generic = describeRegisterError(new RegisterApiError(500, null), 'lookup');
		expect(d.message).toBe(generic.message);
		expect(d.message).not.toBe(
			describeRegisterError(new RegisterApiError(404, null), 'save').message
		);
	});
});
