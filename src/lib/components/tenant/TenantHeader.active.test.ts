import { render, screen, within } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TenantHeader from './TenantHeader.svelte';
import { makeTenant } from './tenant-fixture';

const pageStore = vi.hoisted(() => ({ ref: null as null | { set: (v: unknown) => void } }));

vi.mock('$app/stores', async () => {
	const { writable: w } = await import('svelte/store');
	const store = w({
		url: new URL('http://events.example.org/'),
		data: { features: {}, tenant: null }
	});
	pageStore.ref = store;
	return { page: store };
});

// SSR `resolve()` returns PAGE-relative hrefs (paths.relative defaults to true).
vi.mock('$app/paths', () => ({
	resolve: (route: string, params?: { slug?: string }) =>
		route === '/(public)' ? './' : `./org/${params?.slug}/membership`
}));

function at(pathname: string): void {
	pageStore.ref?.set({
		url: new URL(`http://events.example.org${pathname}`),
		data: { features: {}, tenant: null }
	});
}

const nav = () => within(screen.getByRole('navigation', { name: 'Organization navigation' }));

describe('TenantHeader active link with SSR page-relative hrefs', () => {
	beforeEach(() => at('/'));

	it('marks Events current on the root URL on first paint', () => {
		render(TenantHeader, { props: { tenant: makeTenant({ has_membership_plans: true }) } });
		expect(nav().getByRole('link', { name: 'Events' })).toHaveAttribute('aria-current', 'page');
		expect(nav().getByRole('link', { name: 'Membership' })).not.toHaveAttribute('aria-current');
	});

	it('marks Membership current (and not Events) on its page', () => {
		at('/org/acme/membership');
		render(TenantHeader, { props: { tenant: makeTenant({ has_membership_plans: true }) } });
		expect(nav().getByRole('link', { name: 'Membership' })).toHaveAttribute('aria-current', 'page');
		expect(nav().getByRole('link', { name: 'Events' })).not.toHaveAttribute('aria-current');
	});
});
