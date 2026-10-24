import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import DashboardOrganizationsSection from './DashboardOrganizationsSection.svelte';
import type {
	OrganizationRetrieveSchema,
	OrganizationPermissionsSchema
} from '$lib/api/generated/types.gen';

const pageData = vi.hoisted(() => ({
	value: {} as { tenant: { id: string; slug: string; name: string } | null }
}));
const TENANT = { id: 't1', slug: 'night-owls', name: 'Night Owls' };

vi.mock('$app/state', () => ({
	page: {
		get url() {
			return new URL('https://letsrevel.io/dashboard');
		},
		get data() {
			return pageData.value;
		}
	}
}));

const org = {
	id: 't1',
	name: 'Night Owls',
	slug: 'night-owls',
	description: 'Parties',
	tags: []
} as unknown as OrganizationRetrieveSchema;

describe('DashboardOrganizationsSection tenant behaviour', () => {
	beforeEach(() => {
		pageData.value = { tenant: null };
	});

	it('keeps the platform empty state when tenant is null', () => {
		render(DashboardOrganizationsSection, {
			organizations: [],
			isLoading: false,
			permissions: null
		});
		expect(screen.getByRole('heading', { name: 'My Organizations' })).toBeInTheDocument();
		expect(screen.getByText('No organizations yet')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Discover Events' })).toBeInTheDocument();
	});

	it('renders nothing on a tenant host when the list is empty', () => {
		pageData.value = { tenant: TENANT };
		const { container } = render(DashboardOrganizationsSection, {
			organizations: [],
			isLoading: false,
			permissions: null
		});
		expect(container.querySelector('section')).toBeNull();
		expect(screen.queryByRole('heading', { name: 'My Organizations' })).not.toBeInTheDocument();
		expect(screen.queryByText('No organizations yet')).not.toBeInTheDocument();
	});

	it('still lists the org card on a tenant host when non-empty', () => {
		pageData.value = { tenant: TENANT };
		render(DashboardOrganizationsSection, {
			organizations: [org],
			isLoading: false,
			permissions: null
		});
		expect(screen.getByRole('heading', { name: 'My Organizations' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Night Owls' })).toBeInTheDocument();
	});

	describe('platform admin hint', () => {
		const owner = {
			organization_permissions: { t1: 'owner' }
		} as unknown as OrganizationPermissionsSchema;
		const HINT = 'Opens on Revel. Sign in there once.';

		it('describes the Admin link on a tenant host', () => {
			pageData.value = { tenant: TENANT };
			render(DashboardOrganizationsSection, {
				organizations: [org],
				isLoading: false,
				permissions: owner
			});
			const admin = screen.getByRole('link', { name: 'Admin' });
			expect(screen.getByText(HINT)).toBeVisible();
			expect(admin).toHaveAccessibleDescription(HINT);
		});

		it('is absent on the platform', () => {
			render(DashboardOrganizationsSection, {
				organizations: [org],
				isLoading: false,
				permissions: owner
			});
			const admin = screen.getByRole('link', { name: 'Admin' });
			expect(screen.queryByText(HINT)).not.toBeInTheDocument();
			expect(admin).not.toHaveAttribute('aria-describedby');
		});

		it('is absent on a tenant host without admin permissions', () => {
			pageData.value = { tenant: TENANT };
			render(DashboardOrganizationsSection, {
				organizations: [org],
				isLoading: false,
				permissions: null
			});
			expect(screen.queryByText(HINT)).not.toBeInTheDocument();
		});
	});
});
