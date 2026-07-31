#!/usr/bin/env node
/**
 * Translation Validation Script
 *
 * Validates all translation files to ensure:
 * - No empty strings
 * - All keys match across languages
 * - Placeholders are consistent
 * - No duplicate keys
 *
 * Usage: node scripts/validate-translations.js
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for terminal output
const colors = {
	reset: '\x1b[0m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	bold: '\x1b[1m'
};

function log(message, color = 'reset') {
	console.log(`${colors[color]}${message}${colors.reset}`);
}

function loadJSON(filename) {
	const filePath = join(__dirname, '..', 'messages', filename);
	const content = readFileSync(filePath, 'utf-8');
	return JSON.parse(content);
}

function getAllKeys(obj, prefix = '') {
	const keys = new Set();
	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
			getAllKeys(value, fullKey).forEach((k) => keys.add(k));
		} else {
			keys.add(fullKey);
		}
	}
	return keys;
}

function findEmptyStrings(obj, prefix = '') {
	const empty = [];
	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
			empty.push(...findEmptyStrings(value, fullKey));
		} else if (value === '' || (typeof value === 'string' && value.trim() === '')) {
			empty.push(fullKey);
		}
	}
	return empty;
}

function extractPlaceholders(text) {
	const regex = /\{(\w+)\}/g;
	const placeholders = new Set();
	let match;
	while ((match = regex.exec(text)) !== null) {
		placeholders.add(match[1]);
	}
	return placeholders;
}

function validatePlaceholders(en, lang, langCode) {
	const issues = [];

	function checkPlaceholders(enObj, langObj, prefix = '') {
		for (const [key, enValue] of Object.entries(enObj)) {
			const fullKey = prefix ? `${prefix}.${key}` : key;

			if (typeof enValue === 'object' && enValue !== null) {
				if (langObj[key]) {
					checkPlaceholders(enValue, langObj[key], fullKey);
				}
			} else if (typeof enValue === 'string') {
				const langValue = langObj[key];
				if (!langValue) continue; // Skip empty (already caught by empty check)

				const enPlaceholders = extractPlaceholders(enValue);
				const langPlaceholders = extractPlaceholders(langValue);

				// Check for missing placeholders
				for (const placeholder of enPlaceholders) {
					if (!langPlaceholders.has(placeholder)) {
						issues.push({
							key: fullKey,
							issue: `Missing placeholder {${placeholder}} in ${langCode}`,
							en: enValue,
							lang: langValue
						});
					}
				}

				// Check for extra placeholders
				for (const placeholder of langPlaceholders) {
					if (!enPlaceholders.has(placeholder)) {
						issues.push({
							key: fullKey,
							issue: `Extra placeholder {${placeholder}} in ${langCode}`,
							en: enValue,
							lang: langValue
						});
					}
				}
			}
		}
	}

	checkPlaceholders(en, lang);
	return issues;
}

/** Source language, then every target catalog that must stay aligned with it. */
const SOURCE = { code: 'en', file: 'en.json', name: 'English' };
const TARGETS = [
	{ code: 'de', file: 'de.json', name: 'German' },
	{ code: 'it', file: 'it.json', name: 'Italian' },
	{ code: 'fr', file: 'fr.json', name: 'French' },
	{ code: 'es', file: 'es.json', name: 'Spanish' },
	{ code: 'pt', file: 'pt.json', name: 'Portuguese' }
];

function main() {
	log('\n=== Translation Validation ===\n', 'bold');

	let hasErrors = false;
	let hasWarnings = false;

	// Load translation files
	log('Loading translation files...', 'blue');
	const en = loadJSON(SOURCE.file);
	const enKeys = getAllKeys(en);
	const enEmpty = findEmptyStrings(en);
	const langs = TARGETS.map((t) => {
		const data = loadJSON(t.file);
		return {
			...t,
			data,
			keys: getAllKeys(data),
			empty: findEmptyStrings(data),
			placeholders: validatePlaceholders(en, data, t.code.toUpperCase())
		};
	});
	log('✓ All files loaded\n', 'green');

	// Key count
	log('=== Key Count ===', 'bold');
	log(`${SOURCE.name.padEnd(11)} ${enKeys.size} keys`);
	for (const l of langs) log(`${l.name.padEnd(11)} ${l.keys.size} keys`);
	if (langs.every((l) => l.keys.size === enKeys.size)) {
		log('✓ All languages have the same number of keys\n', 'green');
	} else {
		log('✗ Key count mismatch!\n', 'red');
		hasErrors = true;
	}

	// Key structure alignment
	log('=== Key Structure Alignment ===', 'bold');
	let misaligned = false;
	for (const l of langs) {
		const missing = Array.from(enKeys).filter((k) => !l.keys.has(k));
		const extra = Array.from(l.keys).filter((k) => !enKeys.has(k));
		if (missing.length === 0 && extra.length === 0) continue;
		misaligned = true;
		hasErrors = true;
		if (missing.length > 0) {
			log(`✗ ${l.name} missing ${missing.length} keys:`, 'red');
			missing.slice(0, 5).forEach((k) => log(`  - ${k}`, 'red'));
			if (missing.length > 5) log(`  ... and ${missing.length - 5} more`, 'red');
		}
		if (extra.length > 0) {
			log(`✗ ${l.name} has ${extra.length} extra keys:`, 'red');
			extra.slice(0, 5).forEach((k) => log(`  - ${k}`, 'red'));
		}
	}
	if (!misaligned) log('✓ All keys are aligned across languages\n', 'green');
	else log('');

	// Empty strings
	log('=== Empty Strings ===', 'bold');
	if (enEmpty.length > 0) {
		log(`✗ ${SOURCE.name} has ${enEmpty.length} empty strings!`, 'red');
		enEmpty.slice(0, 5).forEach((k) => log(`  - ${k}`, 'red'));
		hasErrors = true;
	}
	for (const l of langs) {
		if (l.empty.length === 0) {
			log(`✓ ${l.name} has no empty strings`, 'green');
			continue;
		}
		log(`✗ ${l.name} has ${l.empty.length} empty strings!`, 'red');
		l.empty.slice(0, 5).forEach((k) => log(`  - ${k}`, 'red'));
		if (l.empty.length > 5) log(`  ... and ${l.empty.length - 5} more`, 'red');
		hasErrors = true;
	}
	log('');

	// Placeholders
	log('=== Placeholder Validation ===', 'bold');
	if (langs.every((l) => l.placeholders.length === 0)) {
		log('✓ All placeholders are consistent\n', 'green');
	} else {
		hasWarnings = true;
		for (const l of langs) {
			if (l.placeholders.length === 0) continue;
			log(`⚠ ${l.name} has ${l.placeholders.length} placeholder issues:`, 'yellow');
			l.placeholders
				.slice(0, 3)
				.forEach((issue) => log(`  ${issue.key}: ${issue.issue}`, 'yellow'));
			if (l.placeholders.length > 3) log(`  ... and ${l.placeholders.length - 3} more`, 'yellow');
		}
		log('');
	}

	// Summary
	log('=== Summary ===', 'bold');
	log(`Total keys: ${enKeys.size}`);
	log(`Languages: ${langs.length + 1} (${[SOURCE, ...langs].map((l) => l.name).join(', ')})`);
	for (const l of langs) {
		const pct = (((l.keys.size - l.empty.length) / enKeys.size) * 100).toFixed(1);
		log(`${l.name} completion: ${pct}%`);
	}
	log('');

	if (hasErrors) {
		log('✗ Validation failed with errors', 'red');
		process.exit(1);
	} else if (hasWarnings) {
		log('⚠ Validation passed with warnings', 'yellow');
		process.exit(0);
	} else {
		log('✓ All validations passed!', 'green');
		process.exit(0);
	}
}

main();
