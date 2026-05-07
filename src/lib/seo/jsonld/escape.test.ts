import { describe, it, expect } from 'vitest';
import { toJsonLd } from '$lib/seo/jsonld/escape';

describe('toJsonLd', () => {
	it('serializes an object to JSON', () => {
		expect(toJsonLd({ a: 1 })).toBe('{"a":1}');
	});

	it('escapes </script sequences to prevent script-tag breakout', () => {
		const evil = { x: '</script><script>alert(1)</script>' };
		const result = toJsonLd(evil);
		expect(result).not.toContain('</script');
		expect(result).toContain('\\u003c/script');
	});

	it('returns minimal valid JSON-LD when serialization throws', () => {
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		const result = toJsonLd(circular);
		expect(() => JSON.parse(result)).not.toThrow();
	});
});
