import { describe, it, expect, vi, beforeEach } from 'vitest';

const pageUrl = vi.hoisted(() => ({ href: 'http://localhost/events/acme/series/s' }));
vi.mock('$app/state', () => ({
	page: {
		get url() {
			return new URL(pageUrl.href);
		}
	}
}));

import {
	safeInternalReturnUrl,
	isPassFlowReturnTarget,
	isPassPageReturnTarget,
	passQuestionnaireReturnUrl,
	withSearchParam,
	currentPageReturnPath
} from './internal-return-url';

describe('withSearchParam', () => {
	it('adds the param to a bare path', () => {
		expect(withSearchParam('/events/a/series/s', 'questionnaire', 'pending')).toBe(
			'/events/a/series/s?questionnaire=pending'
		);
	});
	it('merges into an existing query and keeps the hash', () => {
		expect(withSearchParam('/events/a/series/s?page=2#passes', 'questionnaire', 'done')).toBe(
			'/events/a/series/s?page=2&questionnaire=done#passes'
		);
	});
	it('replaces a stale value instead of duplicating it', () => {
		expect(withSearchParam('/p?questionnaire=pending', 'questionnaire', 'done')).toBe(
			'/p?questionnaire=done'
		);
	});
});

describe('pass return allow-list', () => {
	it('allows event, series and passes-dashboard pages', () => {
		expect(isPassFlowReturnTarget('/events/acme/ev')).toBe(true);
		expect(isPassFlowReturnTarget('/events/acme/series/s?page=2')).toBe(true);
		expect(isPassFlowReturnTarget('/dashboard/passes')).toBe(true);
	});
	it('rejects everything else, including traversal out of /events/', () => {
		expect(isPassFlowReturnTarget('/dashboard/settings')).toBe(false);
		expect(isPassFlowReturnTarget('/login')).toBe(false);
		expect(isPassFlowReturnTarget('/events/../login')).toBe(false);
		expect(isPassFlowReturnTarget(null)).toBe(false);
	});
	it('words only series pages and the passes dashboard as "the pass"', () => {
		expect(isPassPageReturnTarget('/events/acme/series/s')).toBe(true);
		expect(isPassPageReturnTarget('/dashboard/passes')).toBe(true);
		expect(isPassPageReturnTarget('/events/acme/ev')).toBe(false);
		expect(isPassPageReturnTarget('/login')).toBe(false);
	});
});

describe('reading ?returnUrl=', () => {
	beforeEach(() => {
		pageUrl.href = 'http://localhost/events/acme/ev/questionnaire/q';
	});
	it('safeInternalReturnUrl keeps any same-origin path and drops off-site ones', () => {
		pageUrl.href += '?returnUrl=%2Fdashboard%2Fsettings';
		expect(safeInternalReturnUrl()).toBe('/dashboard/settings');
		pageUrl.href = 'http://localhost/x?returnUrl=https%3A%2F%2Fevil.com';
		expect(safeInternalReturnUrl()).toBeNull();
	});
	it('passQuestionnaireReturnUrl falls back to null outside the allow-list', () => {
		pageUrl.href += '?returnUrl=%2Fdashboard%2Fsettings';
		expect(passQuestionnaireReturnUrl()).toBeNull();
		pageUrl.href = 'http://localhost/x?returnUrl=%2Fevents%2Facme%2Fseries%2Fs';
		expect(passQuestionnaireReturnUrl()).toBe('/events/acme/series/s');
	});
});

describe('currentPageReturnPath', () => {
	it('uses the SvelteKit page url and drops the one-shot questionnaire signal', () => {
		pageUrl.href = 'http://localhost/events/acme/series/s?page=2&questionnaire=pending';
		expect(currentPageReturnPath()).toBe('/events/acme/series/s?page=2');
	});
});

describe('quote invalidation after a questionnaire submission', () => {
	it('allQuotes is a prefix of every pass quote key, so one invalidation reaches them all', async () => {
		const { seriesPassQueryKeys } = await import('$lib/queries/series-passes');
		const key = seriesPassQueryKeys.quote('series-1', 'pass-1');
		expect(key.slice(0, seriesPassQueryKeys.allQuotes.length)).toEqual(
			seriesPassQueryKeys.allQuotes
		);
	});
});
