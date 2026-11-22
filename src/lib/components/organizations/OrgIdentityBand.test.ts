import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import OrgIdentityBand from './OrgIdentityBand.svelte';

describe('OrgIdentityBand', () => {
	it('renders the name, location and only the social links that are set', () => {
		render(OrgIdentityBand, {
			props: {
				organization: {
					name: 'Acme Club',
					instagram_url: 'https://instagram.com/acme',
					facebook_url: null,
					bluesky_url: '',
					telegram_url: 'https://t.me/acme'
				},
				logoUrl: null,
				locationDisplay: 'Vienna, Austria'
			}
		});

		expect(screen.getByRole('heading', { name: 'Acme Club' })).toBeInTheDocument();
		expect(screen.getByText('Vienna, Austria')).toBeInTheDocument();
		const links = screen.getAllByRole('link');
		expect(links.map((a) => a.getAttribute('href'))).toEqual([
			'https://instagram.com/acme',
			'https://t.me/acme'
		]);
		for (const a of links) {
			expect(a).toHaveAttribute('target', '_blank');
			expect(a).toHaveAttribute('rel', 'noopener noreferrer');
			expect(a).toHaveAccessibleName();
		}
	});

	it('shows the initial tile when there is no logo', () => {
		render(OrgIdentityBand, {
			props: { organization: { name: 'beta' }, logoUrl: null, locationDisplay: null }
		});
		expect(screen.getByText('B')).toBeInTheDocument();
		expect(screen.queryAllByRole('link')).toHaveLength(0);
	});
});
