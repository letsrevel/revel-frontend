import { render } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import { describe, it, expect, vi } from 'vitest';
import ErrorPage from './+error.svelte';

// The skip link targets #main-content; the error page must own that target
// itself (no layout-supplied stand-in), so render it alone and count it.
vi.mock('$app/stores', () => ({
	page: readable({
		status: 404,
		error: { message: 'Not found' },
		url: new URL('http://localhost/missing')
	})
}));
vi.mock('$app/state', () => ({
	page: { data: { tenant: null }, url: new URL('http://localhost/missing') }
}));

describe('+error.svelte skip target', () => {
	it('renders exactly one main#main-content', () => {
		const { container } = render(ErrorPage);
		expect(container.querySelectorAll('main#main-content')).toHaveLength(1);
	});
});
