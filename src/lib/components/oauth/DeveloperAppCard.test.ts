import { render, screen, within } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import type { OAuthAppSchema } from '$lib/api/generated/types.gen';
import { formatDateTime } from '$lib/utils/date';
import DeveloperAppCard from './DeveloperAppCard.svelte';

function app(overrides: Partial<OAuthAppSchema> = {}): OAuthAppSchema {
	return {
		registration_source: 'manual',
		id: 'app-1',
		client_id: 'cid-1',
		name: 'Acme Planner',
		description: 'Plans things.',
		client_type: 'confidential',
		allowed_scopes: ['openid'],
		homepage_url: '',
		privacy_policy_url: '',
		verified: false,
		is_active: true,
		redirect_uris: ['https://acme.example/cb'],
		last_used_at: '2026-09-02T12:30:00Z',
		logo_url: null,
		connections_count: 3,
		...overrides
	};
}

function badges(card: HTMLElement): string[] {
	return within(card)
		.getAllByTestId('status-badge')
		.map((b) => b.textContent?.trim() ?? '');
}

describe('DeveloperAppCard', () => {
	it('is an article named after the app with a link to its detail page', () => {
		render(DeveloperAppCard, { props: { app: app() } });
		const card = screen.getByRole('article', { name: 'Acme Planner' });
		const heading = within(card).getByRole('heading', { level: 3 });
		const link = within(heading).getByRole('link', { name: 'Acme Planner' });
		expect(link).toHaveAttribute('href', '/account/developer-apps/app-1');
	});

	it('shows type and active badges, no verified badge by default', () => {
		render(DeveloperAppCard, { props: { app: app() } });
		expect(badges(screen.getByRole('article'))).toEqual(['Confidential', 'Active']);
	});

	it('shows public, inactive and verified badges', () => {
		render(DeveloperAppCard, {
			props: { app: app({ client_type: 'public', is_active: false, verified: true }) }
		});
		expect(badges(screen.getByRole('article'))).toEqual(['Public', 'Inactive', 'Verified']);
	});

	it('pluralizes the usage count', () => {
		const { unmount } = render(DeveloperAppCard, { props: { app: app({ connections_count: 1 }) } });
		expect(screen.getByText('Used by 1 person')).toBeInTheDocument();
		unmount();
		render(DeveloperAppCard, { props: { app: app({ connections_count: 3 }) } });
		expect(screen.getByText('Used by 3 people')).toBeInTheDocument();
	});

	it('shows the last-used time, or "Never used"', () => {
		const { unmount } = render(DeveloperAppCard, { props: { app: app() } });
		expect(
			screen.getByText(`Last used ${formatDateTime('2026-09-02T12:30:00Z')}`)
		).toBeInTheDocument();
		unmount();
		render(DeveloperAppCard, {
			props: { app: app({ last_used_at: null, connections_count: undefined }) }
		});
		expect(screen.getByText('Never used')).toBeInTheDocument();
		expect(screen.getByText('Used by 0 people')).toBeInTheDocument();
	});
});
