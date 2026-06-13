import { describe, it, expect, beforeEach } from 'vitest';
import { register, recordRequest, recordSsrError, startMetricsServer } from './metrics';

describe('metrics — registry', () => {
	beforeEach(() => {
		// Reset only the custom counters/histograms between tests; keep registry.
		register.resetMetrics();
	});

	it('exposes the three custom frontend metrics plus Node defaults', async () => {
		const names = (await register.getMetricsAsJSON()).map((m) => m.name);
		expect(names).toContain('frontend_http_requests_total');
		expect(names).toContain('frontend_http_request_duration_seconds');
		expect(names).toContain('frontend_ssr_errors_total');
		// collectDefaultMetrics registered Node process metrics on the same registry
		expect(names).toContain('process_cpu_user_seconds_total');
	});

	it('labels requests by route id, method and status', async () => {
		recordRequest({
			method: 'POST',
			status: 303,
			route: '/(public)/login',
			durationSeconds: 0.142
		});
		const metrics = await register.getMetricsAsJSON();
		const counter = metrics.find((m) => m.name === 'frontend_http_requests_total');
		expect(counter?.values[0].labels).toEqual({
			method: 'POST',
			status: '303',
			route: '/(public)/login'
		});
		expect(counter?.values[0].value).toBe(1);
	});

	it('falls back to "unknown" route when the route id is null', async () => {
		recordRequest({ method: 'GET', status: 404, route: null, durationSeconds: 0.01 });
		const metrics = await register.getMetricsAsJSON();
		const counter = metrics.find((m) => m.name === 'frontend_http_requests_total');
		expect(counter?.values[0].labels.route).toBe('unknown');
	});

	it('observes request duration in the histogram under the route label', async () => {
		recordRequest({ method: 'GET', status: 200, route: '/(public)', durationSeconds: 0.3 });
		const metrics = await register.getMetricsAsJSON();
		const hist = metrics.find((m) => m.name === 'frontend_http_request_duration_seconds');
		const sum = hist?.values.find((v) => v.metricName?.endsWith('_sum'));
		expect(sum?.value).toBeCloseTo(0.3, 5);
		expect(sum?.labels).toMatchObject({ method: 'GET', route: '/(public)' });
	});

	it('increments the SSR error counter by route', async () => {
		recordSsrError('/(auth)/dashboard');
		recordSsrError('/(auth)/dashboard');
		const metrics = await register.getMetricsAsJSON();
		const counter = metrics.find((m) => m.name === 'frontend_ssr_errors_total');
		const entry = counter?.values.find((v) => v.labels.route === '/(auth)/dashboard');
		expect(entry?.value).toBe(2);
	});
});

describe('metrics — record helpers never throw', () => {
	it('recordRequest swallows bad input', () => {
		// @ts-expect-error intentionally malformed
		expect(() => recordRequest({})).not.toThrow();
	});

	it('recordSsrError swallows bad input', () => {
		// @ts-expect-error intentionally malformed
		expect(() => recordSsrError(undefined)).not.toThrow();
	});
});

describe('metrics — server is not started under Vitest', () => {
	it('startMetricsServer is a no-op in the test environment', () => {
		// VITEST is set by the test runner; the guard must short-circuit.
		expect(startMetricsServer()).toBeUndefined();
	});
});
