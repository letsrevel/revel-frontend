import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

describe('project.inlang/settings.json', () => {
	const settings = JSON.parse(
		readFileSync(resolve(process.cwd(), 'project.inlang/settings.json'), 'utf-8')
	) as { modules: string[] };

	it('pins every remote module to an exact version (these run at build time)', () => {
		expect(settings.modules.length).toBeGreaterThan(0);
		for (const url of settings.modules) {
			expect(url).not.toContain('@latest');
			expect(url).toMatch(/@\d+\.\d+\.\d+\//);
		}
	});
});
