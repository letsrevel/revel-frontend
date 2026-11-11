#!/usr/bin/env node
/**
 * Assert that the i18n hardcoded-string gate (`make i18n-hardcoded`) can actually fail.
 *
 * The gate's CLI entry used to compare `resolve(argv[1])` with `import.meta.url`
 * (which the ESM loader realpaths). Through a symlinked path main() was skipped and
 * the gate exited 0 having scanned nothing: a silent self-disarm, same class as the
 * type gate (#704). Only a known leak that MUST be reported is decisive, so this:
 *   1. runs the CLI through a symlink (like macOS /tmp -> /private/tmp) on a fixture
 *      with a known leak and requires a NON-zero exit that names the leak;
 *   2. runs the CLI with no arguments through the same symlink and requires it to
 *      print a verdict (main() ran) rather than exit silently.
 */
import { spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const script = resolve(dirname(fileURLToPath(import.meta.url)), 'check-i18n-hardcoded.mjs');
const dir = mkdtempSync(join(tmpdir(), 'i18n-canary-'));
let failed = false;
const fail = (msg) => {
	console.error(`i18n-hardcoded canary FAILED: ${msg}`);
	failed = true;
};

try {
	const link = join(dir, 'gate.mjs');
	symlinkSync(script, link);
	const fixture = join(dir, 'Leak.svelte');
	writeFileSync(fixture, '<button aria-label="Close the dialog">x</button>\n');

	const scan = spawnSync('node', [link, '--scan', fixture], { encoding: 'utf-8' });
	if (scan.status === 0) fail('a fixture with a known leak exited 0 (gate is disarmed)');
	else if (!scan.stdout.includes('Close the dialog')) fail('the known leak was not reported');

	const full = spawnSync('node', [link], { encoding: 'utf-8' });
	if (!`${full.stdout}${full.stderr}`.trim()) fail('the CLI printed nothing: main() did not run');
} finally {
	rmSync(dir, { recursive: true, force: true });
}

if (failed) process.exit(1);
console.log('✓ i18n-hardcoded gate canary: a known leak is reported through a symlinked path');
