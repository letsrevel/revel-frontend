import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import { readable } from 'svelte/store';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import * as m from '$lib/paraglide/messages.js';
import Page from './+page.svelte';

const { getCode } = vi.hoisted(() => ({ getCode: vi.fn() }));

vi.mock('$app/stores', () => ({
	page: readable({
		data: { organization: { id: 'org-1', slug: 'acme', name: 'Acme' } },
		params: { code_id: 'dc-1' }
	})
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadmindiscountcodesGetDiscountCode: getCode,
	organizationadmindiscountcodesUpdateDiscountCode: vi.fn()
}));
vi.mock('$lib/components/discount-codes/DiscountCodeForm.svelte', async () => ({
	default: (await import('$lib/test-utils/StubComponent.svelte')).default
}));

describe('discount code edit page', () => {
	it('shows the code in monospace and reads the parameterized sentence once', async () => {
		getCode.mockResolvedValue({ data: { id: 'dc-1', code: 'SUMMER25' }, error: undefined });
		render(QueryClientTestWrapper, {
			props: {
				client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
				component: Page,
				componentProps: {}
			}
		});

		const visible = await screen.findByText('SUMMER25', { selector: '[aria-hidden="true"]' });
		expect(visible.className).toContain('font-mono');
		expect(screen.getByText(m['discountCodeEditPage.editing']({ code: 'SUMMER25' }))).toHaveClass(
			'sr-only'
		);
	});
});
