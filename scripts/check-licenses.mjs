#!/usr/bin/env node
// License compliance gate — the frontend mirror of the backend's `make licensecheck`.
//
// Fails CI if any installed package carries a copyleft / source-available license
// that would contaminate our (proprietary) distribution. Mirrors the backend's
// denylist: GPL / AGPL / LGPL / SSPL / BUSL (Business Source License) / Commons-Clause.
//
// Reads `pnpm licenses list --json`, whose top-level keys are license *expressions*
// (e.g. "MIT", "Apache-2.0", "(MIT OR CC0-1.0)", "Apache License 2.0"). SPDX "OR"
// expressions are satisfied if *any* operand is acceptable (we can pick the
// permissive option), so a "(MIT OR GPL-2.0)" dual-license does NOT fail the gate.
//
// Usage: node scripts/check-licenses.mjs
// Exit:  0 = clean, 1 = forbidden license found, 2 = tooling error.

import { execFileSync } from 'node:child_process';

// Denylisted license patterns (matched case-insensitively against each SPDX operand).
const DENY = [
	/\bA?GPL\b/i, // GPL, AGPL (and "GPL-3.0-only", "AGPL-3.0", etc.)
	/\bLGPL\b/i,
	/\bSSPL\b/i,
	/\bBUSL\b/i,
	/business source license/i,
	/commons[-\s]?clause/i
];

// Packages explicitly allowed despite a matching license string, each with a reason.
// Mirrors the backend's grandfathered-package list. Keep empty unless a real,
// reviewed exception arises — add as `'pkg-name': 'why it is safe'`.
const ALLOW = {
	// e.g. 'some-pkg': 'LGPL binding we link dynamically; reviewed 2026-06',
};

/** An operand is acceptable if it is NOT on the denylist. */
function operandIsForbidden(operand) {
	return DENY.some((re) => re.test(operand));
}

/**
 * A full SPDX expression is forbidden only when there is no permissive way to
 * satisfy it: every top-level OR alternative must contain a forbidden term.
 */
function expressionIsForbidden(expression) {
	const alternatives = expression
		.replace(/[()]/g, ' ')
		.split(/\s+OR\s+/i)
		.map((s) => s.trim())
		.filter(Boolean);
	if (alternatives.length === 0) return false;
	// Forbidden iff *every* alternative is forbidden (no permissive escape hatch).
	return alternatives.every((alt) => operandIsForbidden(alt));
}

function main() {
	let raw;
	try {
		raw = execFileSync('pnpm', ['licenses', 'list', '--json'], {
			encoding: 'utf8',
			maxBuffer: 64 * 1024 * 1024
		});
	} catch (err) {
		console.error('✖ Failed to run `pnpm licenses list --json`:', err.message);
		process.exit(2);
	}

	let data;
	try {
		data = JSON.parse(raw);
	} catch {
		console.error('✖ Could not parse pnpm license output as JSON.');
		process.exit(2);
	}

	const violations = [];
	for (const [license, pkgs] of Object.entries(data)) {
		if (!expressionIsForbidden(license)) continue;
		for (const pkg of pkgs) {
			if (ALLOW[pkg.name]) continue;
			violations.push({ name: pkg.name, versions: pkg.versions, license });
		}
	}

	if (violations.length > 0) {
		console.error('✖ Forbidden (copyleft / source-available) licenses found:\n');
		for (const v of violations) {
			console.error(`  ${v.name}@${(v.versions || []).join(',')} — ${v.license}`);
		}
		console.error(
			'\nResolve by removing/replacing the dependency, or — if genuinely safe — ' +
				'add it to ALLOW in scripts/check-licenses.mjs with a reviewed reason.'
		);
		process.exit(1);
	}

	console.log('✓ License check passed — no forbidden licenses in the dependency tree.');
}

main();
