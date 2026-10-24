import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import OrganizationCard from './OrganizationCard.svelte';
import type { OrganizationRetrieveSchema } from '$lib/api/generated/types.gen';

const pageData = vi.hoisted(() => ({
	value: {} as {
		tenant: { custom_domain: string; slug: string } | null;
		customDomains: { enabled: boolean; platformOrigin: string | null };
	}
}));
const resetPageData = () => {
	pageData.value = { tenant: null, customDomains: { enabled: true, platformOrigin: null } };
};
resetPageData();

vi.mock('$app/state', () => ({
	page: {
		get url() {
			return new URL('https://letsrevel.io/organizations');
		},
		get data() {
			return pageData.value;
		}
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
	beforeEach(resetPageData);

	it('ignores the custom domain while tenant mode is off', () => {
		pageData.value.customDomains = { enabled: false, platformOrigin: null };
		render(OrganizationCard, {
			props: { organization: { ...baseOrg, custom_domain: 'owls.example.com' } }
		});
		expect(screen.getByRole('link')).toHaveAttribute('href', '/org/night-owls');
	});

	it('links an org without a custom domain to the platform from a tenant host', () => {
		pageData.value = {
			tenant: { custom_domain: 'other.example.com', slug: 'other' },
			customDomains: { enabled: true, platformOrigin: 'https://app.example.com' }
		};
		render(OrganizationCard, { props: { organization: { ...baseOrg, custom_domain: null } } });
		expect(screen.getByRole('link')).toHaveAttribute(
			'href',
			'https://app.example.com/org/night-owls'
		);
	});

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
