/**
 * Guard for loader return values. SvelteKit serializes load data with devalue,
 * which throws (-> 500) on anything that is not a plain object/array/primitive,
 * e.g. the Blob/ReadableStream the generated client returns when a response body
 * could not be parsed as JSON. Treat those as "no data" so the page degrades
 * instead of failing.
 */
export function plainOrNull<T>(value: T | null | undefined): T | null {
	if (value === null || value === undefined) return null;
	if (typeof value !== 'object') return value;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null || Array.isArray(value) ? value : null;
}
