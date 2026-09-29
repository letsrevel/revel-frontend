import { render, screen, within } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import type { AuthorizeScopeSchema, OAuthConnectionSchema } from '$lib/api/generated/types.gen';
import { formatDate, formatDateTime } from '$lib/utils/date';
import ConnectionCard from './ConnectionCard.svelte';

const VOCAB: AuthorizeScopeSchema[] = [
	{ name: 'openid', label: 'Sign you in', group: 'identity' },
	{ name: 'me:read', label: 'See your profile', group: 'me' },
	{ name: 'org:tickets', label: 'Manage tickets and refunds', group: 'org' }
];

function connection(overrides: Partial<OAuthConnectionSchema> = {}): OAuthConnectionSchema {
	return {
		client_id: 'cid-1',
		application: {
			name: 'Acme Planner',
			description: 'Plans things.',
			logo_url: null,
			verified: false,
			registration_source: 'manual',
			homepage_url: '',
			privacy_policy_url: ''
		},
		scopes: ['org:tickets', 'me:read', 'openid'],
		first_authorized_at: '2026-09-01T10:00:00Z',
		last_used_at: '2026-09-02T12:30:00Z',
		...overrides
	};
}

describe('ConnectionCard', () => {
	it('is an article named after the app, with scopes in vocabulary order', () => {
		render(ConnectionCard, {
			props: { connection: connection(), vocabulary: VOCAB, onRemove: vi.fn() }
		});
		const card = screen.getByRole('article', { name: 'Acme Planner' });
		expect(
			within(card)
				.getAllByRole('listitem')
				.map((li) => li.textContent?.replace(/\s+/g, ' ').trim())
		).toEqual([
			'Sign you in',
			'See your profile',
			'Manage tickets and refunds (Includes payments and refunds)'
		]);
		expect(within(card).queryByRole('heading', { level: 2 })).toBeNull();
	});

	it('shows the dates through the date helpers', () => {
		render(ConnectionCard, {
			props: { connection: connection(), vocabulary: VOCAB, onRemove: vi.fn() }
		});
		expect(screen.getByText(`Connected ${formatDate('2026-09-01T10:00:00Z')}`)).toBeInTheDocument();
		expect(
			screen.getByText(`Last used ${formatDateTime('2026-09-02T12:30:00Z')}`)
		).toBeInTheDocument();
	});

	it('shows the Verified badge only for a verified app', () => {
		const { unmount } = render(ConnectionCard, {
			props: { connection: connection(), vocabulary: VOCAB, onRemove: vi.fn() }
		});
		expect(screen.queryByTestId('status-badge')).toBeNull();
		unmount();
		render(ConnectionCard, {
			props: {
				connection: connection({ application: { ...connection().application, verified: true } }),
				vocabulary: VOCAB,
				onRemove: vi.fn()
			}
		});
		expect(screen.getByTestId('status-badge')).toHaveTextContent('Verified');
	});

	it('keeps an unknown scope as its raw name', () => {
		render(ConnectionCard, {
			props: {
				connection: connection({ scopes: ['org:brand_new', 'openid'] }),
				vocabulary: VOCAB,
				onRemove: vi.fn()
			}
		});
		expect(screen.getAllByRole('listitem').map((li) => li.textContent?.trim())).toEqual([
			'Sign you in',
			'org:brand_new'
		]);
	});

	it('Remove is named with the app and hands the connection back', async () => {
		const onRemove = vi.fn();
		render(ConnectionCard, { props: { connection: connection(), vocabulary: VOCAB, onRemove } });
		await userEvent.click(screen.getByRole('button', { name: 'Remove Acme Planner' }));
		expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'cid-1' }));
	});

	it('disables Remove while removing', () => {
		render(ConnectionCard, {
			props: { connection: connection(), vocabulary: VOCAB, onRemove: vi.fn(), removing: true }
		});
		expect(screen.getByRole('button', { name: 'Remove Acme Planner' })).toBeDisabled();
	});
});
