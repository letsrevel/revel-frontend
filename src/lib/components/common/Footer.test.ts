import { render } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import Footer from './Footer.svelte';

const store = vi.hoisted(() => ({
	backendVersion: '2.35.0' as string | null,
	isDemoMode: false
}));

vi.mock('$lib/stores/app.svelte', () => ({ appStore: store }));
vi.mock('$app/state', () => ({
	page: { data: { features: {} }, url: new URL('http://localhost/') }
}));
vi.mock('$env/dynamic/public', () => ({ env: {} }));

describe('Footer backend version', () => {
	it('separates the demo marker from the version with a space', () => {
		store.isDemoMode = true;
		const { container } = render(Footer);
		expect(container.textContent).toContain('BE v2.35.0 (demo)');
	});

	it('shows no demo marker outside demo mode', () => {
		store.isDemoMode = false;
		const { container } = render(Footer);
		expect(container.textContent).toContain('BE v2.35.0');
		expect(container.textContent).not.toContain('(demo)');
	});
});
