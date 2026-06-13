/**
 * Structured JSON logger for the SvelteKit Node server.
 *
 * Zero dependencies. Emits one JSON line per call to stdout, using the **same
 * field contract as the backend's structlog** so the existing Alloy → Loki
 * pipeline (JSON parse → `level` label → structured metadata) applies unchanged
 * once `frontend` is added to its keep-regex.
 *
 * The field names below are a CONTRACT with `infra/observability/alloy-config.alloy`.
 * Do not rename `event`, `level`, `timestamp`, `logger`, `method`, `path`,
 * `status_code`, `request_id`, `user_id`, `ip_address`, `user_agent`.
 *
 * Observability must never take the site down: every public method is wrapped so
 * a serialization or I/O failure can never throw into the request path.
 *
 * In dev (`NODE_ENV !== 'production'`) lines are pretty-printed instead of JSON.
 */

export type LogLevel = 'debug' | 'info' | 'warning' | 'error';

/** Numeric severity for threshold filtering (higher = more severe). */
const LEVEL_WEIGHT: Record<LogLevel, number> = {
	debug: 10,
	info: 20,
	warning: 30,
	error: 40
};

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Minimum level to emit. Configurable via `LOG_LEVEL`; defaults to `info` in
 * production and `debug` in dev so local work keeps the chatty `[HOOKS]`-style
 * detail without shipping it to Loki.
 */
function resolveMinLevel(): LogLevel {
	const raw = process.env.LOG_LEVEL?.toLowerCase();
	if (raw === 'debug' || raw === 'info' || raw === 'warning' || raw === 'error') {
		return raw;
	}
	return isProduction ? 'info' : 'debug';
}

const minLevel = resolveMinLevel();

/** Arbitrary structured fields attached to a log line. */
export type LogFields = Record<string, unknown>;

/** Error-level fields may carry an `error` that gets serialized to name/message/stack. */
export type ErrorLogFields = LogFields & { error?: unknown };

interface SerializedError {
	name: string;
	message: string;
	stack?: string;
}

/** Serialize an unknown thrown value into a structured, log-safe shape. */
function serializeError(error: unknown): SerializedError {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack
		};
	}
	return {
		name: 'NonError',
		message: typeof error === 'string' ? error : JSON.stringify(error)
	};
}

/** Build the full event dict for a log line, applying the field contract. */
function buildRecord(level: LogLevel, event: string, fields: LogFields): Record<string, unknown> {
	const { error, ...rest } = fields as ErrorLogFields;
	// Caller fields go FIRST so the reserved contract fields below always win — a
	// stray `{ level }`/`{ event }` in `fields` must never override them (the
	// `level` label drives Loki routing; see the field-contract note above).
	const record: Record<string, unknown> = {
		...rest,
		event,
		level,
		timestamp: new Date().toISOString(),
		logger: 'frontend'
	};
	if (error !== undefined) {
		record.error = serializeError(error);
	}
	return record;
}

/** Pretty one-line form for local dev — easy to scan, not meant for Loki. */
function formatPretty(record: Record<string, unknown>): string {
	const { event, level, timestamp, logger, error, ...rest } = record;
	void logger;
	const parts = Object.entries(rest).map(
		([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`
	);
	const head = `[${timestamp}] ${String(level).toUpperCase()} ${event}`;
	const tail = parts.length ? ` ${parts.join(' ')}` : '';
	const err = error
		? `\n  ${(error as SerializedError).stack ?? (error as SerializedError).message}`
		: '';
	return head + tail + err;
}

/** Emit one record at the given level, honoring the threshold. Never throws. */
function emit(level: LogLevel, event: string, fields: LogFields = {}): void {
	try {
		if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minLevel]) {
			return;
		}
		const record = buildRecord(level, event, fields);
		const line = isProduction ? JSON.stringify(record) : formatPretty(record);
		// error/warning → stderr, everything else → stdout (matches stdlib logging streams)
		if (level === 'error' || level === 'warning') {
			process.stderr.write(line + '\n');
		} else {
			process.stdout.write(line + '\n');
		}
	} catch {
		// Observability must never break the request path. Swallow.
	}
}

export const log = {
	debug: (event: string, fields?: LogFields) => emit('debug', event, fields),
	info: (event: string, fields?: LogFields) => emit('info', event, fields),
	warning: (event: string, fields?: LogFields) => emit('warning', event, fields),
	error: (event: string, fields?: ErrorLogFields) => emit('error', event, fields)
};
