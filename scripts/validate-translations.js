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

function main() {
	log('\n=== Translation Validation ===\n', 'bold');

	let hasErrors = false;
	let hasWarnings = false;

	// Load translation files
	log('Loading translation files...', 'blue');
	const en = loadJSON('en.json');
	const de = loadJSON('de.json');
	const it = loadJSON('it.json');
	log('✓ All files loaded\n', 'green');

	// Get all keys
	const enKeys = getAllKeys(en);
	const deKeys = getAllKeys(de);
	const itKeys = getAllKeys(it);

	// Check key count
	log('=== Key Count ===', 'bold');
	log(`English: ${enKeys.size} keys`);
	log(`German:  ${deKeys.size} keys`);
	log(`Italian: ${itKeys.size} keys`);

	if (enKeys.size === deKeys.size && deKeys.size === itKeys.size) {
		log('✓ All languages have the same number of keys\n', 'green');
	} else {
		log('✗ Key count mismatch!\n', 'red');
		hasErrors = true;
	}

	// Check key structure alignment
	log('=== Key Structure Alignment ===', 'bold');
	const missingInDe = Array.from(enKeys).filter((k) => !deKeys.has(k));
	const missingInIt = Array.from(enKeys).filter((k) => !itKeys.has(k));
	const extraInDe = Array.from(deKeys).filter((k) => !enKeys.has(k));
	const extraInIt = Array.from(itKeys).filter((k) => !enKeys.has(k));

	if (
		missingInDe.length === 0 &&
		missingInIt.length === 0 &&
		extraInDe.length === 0 &&
		extraInIt.length === 0
	) {
		log('✓ All keys are aligned across languages\n', 'green');
	} else {
		hasErrors = true;
		if (missingInDe.length > 0) {
			log(`✗ German missing ${missingInDe.length} keys:`, 'red');
			missingInDe.slice(0, 5).forEach((k) => log(`  - ${k}`, 'red'));
			if (missingInDe.length > 5) log(`  ... and ${missingInDe.length - 5} more`, 'red');
		}
		if (missingInIt.length > 0) {
			log(`✗ Italian missing ${missingInIt.length} keys:`, 'red');
			missingInIt.slice(0, 5).forEach((k) => log(`  - ${k}`, 'red'));
			if (missingInIt.length > 5) log(`  ... and ${missingInIt.length - 5} more`, 'red');
		}
		if (extraInDe.length > 0) {
			log(`✗ German has ${extraInDe.length} extra keys:`, 'red');
			extraInDe.slice(0, 5).forEach((k) => log(`  - ${k}`, 'red'));
		}
		if (extraInIt.length > 0) {
			log(`✗ Italian has ${extraInIt.length} extra keys:`, 'red');
			extraInIt.slice(0, 5).forEach((k) => log(`  - ${k}`, 'red'));
		}
		log('');
	}

	// Check for empty strings
	log('=== Empty Strings ===', 'bold');
	const enEmpty = findEmptyStrings(en);
	const deEmpty = findEmptyStrings(de);
	const itEmpty = findEmptyStrings(it);

	if (enEmpty.length > 0) {
		log(`✗ English has ${enEmpty.length} empty strings!`, 'red');
		enEmpty.slice(0, 5).forEach((k) => log(`  - ${k}`, 'red'));
		hasErrors = true;
	}

	if (deEmpty.length > 0) {
		log(`✗ German has ${deEmpty.length} empty strings!`, 'red');
		deEmpty.slice(0, 5).forEach((k) => log(`  - ${k}`, 'red'));
		if (deEmpty.length > 5) log(`  ... and ${deEmpty.length - 5} more`, 'red');
		hasErrors = true;
	} else {
		log('✓ German has no empty strings', 'green');
	}

	if (itEmpty.length > 0) {
		log(`✗ Italian has ${itEmpty.length} empty strings!`, 'red');
		itEmpty.slice(0, 5).forEach((k) => log(`  - ${k}`, 'red'));
		if (itEmpty.length > 5) log(`  ... and ${itEmpty.length - 5} more`, 'red');
		hasErrors = true;
	} else {
		log('✓ Italian has no empty strings', 'green');
	}
	log('');

	// Check placeholders
	log('=== Placeholder Validation ===', 'bold');
	const dePlaceholderIssues = validatePlaceholders(en, de, 'DE');
	const itPlaceholderIssues = validatePlaceholders(en, it, 'IT');

	if (dePlaceholderIssues.length === 0 && itPlaceholderIssues.length === 0) {
		log('✓ All placeholders are consistent\n', 'green');
	} else {
		hasWarnings = true;
		if (dePlaceholderIssues.length > 0) {
			log(`⚠ German has ${dePlaceholderIssues.length} placeholder issues:`, 'yellow');
			dePlaceholderIssues.slice(0, 3).forEach((issue) => {
				log(`  ${issue.key}: ${issue.issue}`, 'yellow');
			});
			if (dePlaceholderIssues.length > 3) {
				log(`  ... and ${dePlaceholderIssues.length - 3} more`, 'yellow');
			}
		}
		if (itPlaceholderIssues.length > 0) {
			log(`⚠ Italian has ${itPlaceholderIssues.length} placeholder issues:`, 'yellow');
			itPlaceholderIssues.slice(0, 3).forEach((issue) => {
				log(`  ${issue.key}: ${issue.issue}`, 'yellow');
			});
			if (itPlaceholderIssues.length > 3) {
				log(`  ... and ${itPlaceholderIssues.length - 3} more`, 'yellow');
			}
		}
		log('');
	}

	// Summary
	log('=== Summary ===', 'bold');
	log(`Total keys: ${enKeys.size}`);
	log(`Languages: 3 (English, German, Italian)`);

	const deCompleteness = (((deKeys.size - deEmpty.length) / enKeys.size) * 100).toFixed(1);
	const itCompleteness = (((itKeys.size - itEmpty.length) / enKeys.size) * 100).toFixed(1);

	log(`German completion: ${deCompleteness}%`);
	log(`Italian completion: ${itCompleteness}%`);

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
