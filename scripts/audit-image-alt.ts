#!/usr/bin/env tsx
// scripts/audit-image-alt.ts
import { readFile } from 'node:fs/promises';
import { glob } from 'glob';

interface Violation {
	file: string;
	line: number;
	snippet: string;
	reason: string;
}

async function main() {
	const files = await glob('src/**/*.svelte');
	const violations: Violation[] = [];

	for (const file of files) {
		const text = await readFile(file, 'utf-8');

		// Find all <img ...> tags (possibly spanning multiple lines)
		const imgTagRegex = /<img\b([^>]*(?:>|$))/gs;
		let match: RegExpExecArray | null;

		while ((match = imgTagRegex.exec(text)) !== null) {
			const fullMatch = match[0];
			const _attrs = match[1];

			// Calculate the line number of the opening <img
			const lineNumber = text.slice(0, match.index).split('\n').length;

			if (!/\balt\s*=/.test(fullMatch)) {
				violations.push({
					file,
					line: lineNumber,
					snippet: fullMatch.replace(/\s+/g, ' ').trim().slice(0, 120),
					reason: 'missing alt attribute'
				});
			}
		}
	}

	if (violations.length === 0) {
		console.log('✓ image-alt audit clean');
		return;
	}
	console.error(`✗ ${violations.length} image-alt violations:`);
	for (const v of violations) {
		console.error(`  ${v.file}:${v.line} — ${v.reason}\n    ${v.snippet}`);
	}
	process.exit(1);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
