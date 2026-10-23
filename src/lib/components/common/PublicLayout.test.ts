import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import PublicLayout from './PublicLayout.svelte';
import AuthLayout from './AuthLayout.svelte';
import { makeTenant } from '$lib/components/tenant/tenant-fixture';

const { pageStore } = vi.hoisted(() => ({
	pageStore: { current: null as null | { set: (v: unknown) => void } }
}));

vi.mock('$app/stores', async () => {
	const { writable: w } = await import('svelte/store');
	const store = w({ url: new URL('http://localhost/'), data: { features: {}, tenant: null } });
	pageStore.current = store;
	return { page: store };
});

// The platform chrome is heavy and irrelevant here: stub it with a marker.
vi.mock('./Header.svelte', async () => ({
	default: (await import('./__mocks__/StubPlatformHeader.svelte')).default
}));
vi.mock('./Footer.svelte', async () => ({
	default: (await import('./__mocks__/StubPlatformFooter.svelte')).default
}));
vi.mock('$lib/components/notifications/GlobalEmailSuppressionBanner.svelte', async () => ({
	default: (await import('./__mocks__/StubPlatformFooter.svelte')).default
}));

function setTenant(tenant: unknown) {
	pageStore.current?.set({ url: new URL('http://localhost/'), data: { features: {}, tenant } });
}

describe.each([
	['PublicLayout', PublicLayout],
	['AuthLayout', AuthLayout]
])('%s chrome switch', (_name, Layout) => {
	it('renders the platform chrome when there is no tenant', () => {
		setTenant(null);
		render(Layout);
		expect(screen.getAllByTestId('platform-header')).toHaveLength(1);
		expect(screen.queryByRole('link', { name: 'Acme Collective' })).toBeNull();
	});

	it('renders the tenant chrome when a tenant is set', () => {
		setTenant(makeTenant());
		render(Layout);
		expect(screen.queryByTestId('platform-header')).toBeNull();
		expect(screen.getByRole('link', { name: 'Acme Collective' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Privacy' })).toBeInTheDocument();
	});
});
