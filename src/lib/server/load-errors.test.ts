import { describe, it, expect } from 'vitest';
import { loaderErrorStatus } from './load-errors';

describe('loaderErrorStatus', () => {
	it.each([
		[404, 404],
		[403, 403],
		[500, 500],
		[503, 500],
		[undefined, 500],
		[400, 502],
		[401, 502],
		[422, 502]
	])('maps backend %s to %s', (backend, expected) => {
		expect(loaderErrorStatus(backend)).toBe(expected);
	});
});
