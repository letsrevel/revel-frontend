import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import OrganizationCard from './OrganizationCard.svelte';
import type { OrganizationRetrieveSchema } from '$lib/api/generated/types.gen';

vi.mock('$app/state', () => ({
	page: {
		get url() {
			return new URL('https://letsrevel.io/organizations');
		},
		data: { tenant: null }
	}
}));

const baseOrg = {
	id: 'org-1',
	name: 'Night Owls',
	slug: 'night-owls',
	description: 'Parties',
	tags: [],
	city: null
} as unknown as OrganizationRetrieveSchema;

describe('OrganizationCard links (#1056)', () => {
	it('uses a relative link without a custom domain', () => {
		render(OrganizationCard, { props: { organization: { ...baseOrg, custom_domain: null } } });
		expect(screen.getByRole('link')).toHaveAttribute('href', '/org/night-owls');
	});

	it('uses an absolute link on the custom domain', () => {
		render(OrganizationCard, {
			props: { organization: { ...baseOrg, custom_domain: 'owls.example.com' } }
		});
		expect(screen.getByRole('link')).toHaveAttribute(
			'href',
			'https://owls.example.com/org/night-owls'
		);
	});
});
