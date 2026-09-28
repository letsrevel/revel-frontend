import { render, screen, within } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import type { AuthorizeScopeSchema } from '$lib/api/generated/types.gen';
import ScopeList from './ScopeList.svelte';

const SCOPES: AuthorizeScopeSchema[] = [
	{ name: 'org:tickets', label: 'Manage tickets and refunds', group: 'org' },
	{ name: 'openid', label: 'Sign you in', group: 'identity' },
	{ name: 'me:read', label: 'See your profile', group: 'me' }
];

describe('ScopeList grouped', () => {
	it('renders one labelled section per group in identity → me → org order', () => {
		render(ScopeList, { props: { scopes: SCOPES } });
		const sections = screen.getAllByRole('region');
		expect(sections).toHaveLength(3);
		expect(sections.map((s) => s.getAttribute('aria-labelledby'))).toEqual(
			sections.map((s) => within(s).getByRole('heading', { level: 2 }).id)
		);
		expect(within(sections[0]).getByRole('listitem')).toHaveTextContent('Sign you in');
		expect(within(sections[2]).getByRole('listitem')).toHaveTextContent(
			'Manage tickets and refunds'
		);
	});

	it('marks money scopes with an sr-only note and only those', () => {
		render(ScopeList, { props: { scopes: SCOPES } });
		const items = screen.getAllByRole('listitem');
		const money = items.filter((li) => li.textContent?.includes('Includes payments and refunds'));
		expect(money).toHaveLength(1);
		expect(money[0]).toHaveTextContent('Manage tickets and refunds');
	});

	it('renders nothing for an empty list (never an empty ul)', () => {
		const { container } = render(ScopeList, { props: { scopes: [] } });
		expect(container.querySelector('ul')).toBeNull();
		expect(container.querySelector('section')).toBeNull();
	});
});

describe('ScopeList compact', () => {
	it('renders a single list in the given order with no headings', () => {
		render(ScopeList, { props: { scopes: SCOPES, variant: 'compact' } });
		expect(screen.queryAllByRole('heading')).toHaveLength(0);
		expect(screen.getAllByRole('list')).toHaveLength(1);
		// The label and the sr-only marker keep a whitespace separator so AT
		// never reads "refundsIncludes"; collapse it before comparing.
		const texts = screen
			.getAllByRole('listitem')
			.map((li) => li.textContent?.replace(/\s+/g, ' ').trim());
		expect(texts).toEqual([
			'Manage tickets and refunds Includes payments and refunds',
			'Sign you in',
			'See your profile'
		]);
	});
});
