import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The logger reads NODE_ENV / LOG_LEVEL at module load, so tests that exercise
 * environment-dependent behavior reset the module registry and re-import under
 * a patched env. A small helper keeps that ceremony in one place.
 */
async function loadLogger(env: Record<string, string | undefined> = {}) {
	vi.resetModules();
	const original: Record<string, string | undefined> = {};
	for (const [k, v] of Object.entries(env)) {
		original[k] = process.env[k];
		if (v === undefined) delete process.env[k];
		else process.env[k] = v;
	}
	const mod = await import('./logger');
	return { ...mod, restore: () => Object.assign(process.env, original) };
}

/** Capture every line written to stdout + stderr during `fn`. */
function captureOutput() {
	const lines: { stream: 'out' | 'err'; line: string }[] = [];
	const out = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
		lines.push({ stream: 'out', line: String(chunk) });
		return true;
	});
	const err = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
		lines.push({ stream: 'err', line: String(chunk) });
		return true;
	});
	return {
		lines,
		json: () => lines.map((l) => JSON.parse(l.line)),
		restore: () => {
			out.mockRestore();
			err.mockRestore();
		}
	};
}

describe('logger — field contract (production JSON)', () => {
	let capture: ReturnType<typeof captureOutput>;

	beforeEach(() => {
		capture = captureOutput();
	});
	afterEach(() => capture.restore());

	it('emits one JSON line per call with the contracted base fields', async () => {
		const { log, restore } = await loadLogger({ NODE_ENV: 'production', LOG_LEVEL: undefined });
		log.info('request_finished', {
			method: 'POST',
			path: '/login',
			status_code: 303,
			duration_ms: 142,
			request_id: 'abc-123',
			user_id: 'user-1',
			ip_address: '1.2.3.4',
			user_agent: 'vitest'
		});
		restore();

		expect(capture.lines).toHaveLength(1);
		const record = JSON.parse(capture.lines[0].line);
		expect(record).toMatchObject({
			event: 'request_finished',
			level: 'info',
			logger: 'frontend',
			method: 'POST',
			path: '/login',
			status_code: 303,
			duration_ms: 142,
			request_id: 'abc-123',
			user_id: 'user-1',
			ip_address: '1.2.3.4',
			user_agent: 'vitest'
		});
		// timestamp is ISO-8601
		expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
	});

	it('writes exactly one trailing newline and valid JSON', async () => {
		const { log, restore } = await loadLogger({ NODE_ENV: 'production' });
		log.info('ping');
		restore();
		expect(capture.lines[0].line.endsWith('\n')).toBe(true);
		expect(() => JSON.parse(capture.lines[0].line)).not.toThrow();
	});

	it('routes info/debug to stdout and warning/error to stderr', async () => {
		const { log, restore } = await loadLogger({ NODE_ENV: 'production', LOG_LEVEL: 'debug' });
		log.debug('d');
		log.info('i');
		log.warning('w');
		log.error('e');
		restore();
		const streams = capture.lines.map((l) => l.stream);
		expect(streams).toEqual(['out', 'out', 'err', 'err']);
	});
});

describe('logger — error serialization', () => {
	let capture: ReturnType<typeof captureOutput>;
	beforeEach(() => (capture = captureOutput()));
	afterEach(() => capture.restore());

	it('serializes an Error to name/message/stack under `error`', async () => {
		const { log, restore } = await loadLogger({ NODE_ENV: 'production' });
		const boom = new TypeError('kaboom');
		log.error('unhandled', { error: boom, route_id: '/x' });
		restore();
		const record = JSON.parse(capture.lines[0].line);
		expect(record.error).toMatchObject({ name: 'TypeError', message: 'kaboom' });
		expect(record.error.stack).toContain('kaboom');
		expect(record.route_id).toBe('/x');
	});

	it('serializes a non-Error thrown value without throwing', async () => {
		const { log, restore } = await loadLogger({ NODE_ENV: 'production' });
		log.error('weird', { error: 'just a string' });
		restore();
		const record = JSON.parse(capture.lines[0].line);
		expect(record.error).toMatchObject({ name: 'NonError', message: 'just a string' });
	});
});

describe('logger — level filtering', () => {
	let capture: ReturnType<typeof captureOutput>;
	beforeEach(() => (capture = captureOutput()));
	afterEach(() => capture.restore());

	it('drops below-threshold levels in production (default info)', async () => {
		const { log, restore } = await loadLogger({ NODE_ENV: 'production', LOG_LEVEL: undefined });
		log.debug('should-drop');
		log.info('should-emit');
		restore();
		expect(capture.lines).toHaveLength(1);
		expect(JSON.parse(capture.lines[0].line).event).toBe('should-emit');
	});

	it('honors an explicit LOG_LEVEL override', async () => {
		const { log, restore } = await loadLogger({ NODE_ENV: 'production', LOG_LEVEL: 'warning' });
		log.info('drop');
		log.warning('keep');
		log.error('keep2');
		restore();
		expect(capture.lines.map((l) => JSON.parse(l.line).event)).toEqual(['keep', 'keep2']);
	});
});

describe('logger — dev pretty-print fallback', () => {
	let capture: ReturnType<typeof captureOutput>;
	beforeEach(() => (capture = captureOutput()));
	afterEach(() => capture.restore());

	it('does not emit JSON in dev', async () => {
		const { log, restore } = await loadLogger({ NODE_ENV: 'development' });
		log.info('request_finished', { status_code: 200 });
		restore();
		const line = capture.lines[0].line;
		expect(() => JSON.parse(line)).toThrow();
		expect(line).toContain('request_finished');
		expect(line).toContain('status_code=200');
	});
});

describe('logger — never throws', () => {
	let capture: ReturnType<typeof captureOutput>;
	beforeEach(() => (capture = captureOutput()));
	afterEach(() => capture.restore());

	it('swallows serialization errors (circular fields) instead of throwing', async () => {
		const { log, restore } = await loadLogger({ NODE_ENV: 'production' });
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		expect(() => log.info('cycle', { circular })).not.toThrow();
		restore();
	});
});
