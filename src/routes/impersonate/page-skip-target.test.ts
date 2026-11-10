import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import ImpersonatePage from './+page.svelte';
import type { PageData } from './$types';

// The skip link targets #main-content; the impersonation page must own that
// target itself (no layout-supplied stand-in), so render it alone and count it.
describe('impersonate page skip target', () => {
	it('renders exactly one main#main-content', () => {
		const data = {
			error: 'missing_token',
			errorMessage: 'No impersonation token provided.'
		} as PageData;
		const { container } = render(ImpersonatePage, { props: { data } });
		expect(container.querySelectorAll('main#main-content')).toHaveLength(1);
	});
});
