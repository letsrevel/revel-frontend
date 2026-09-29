import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import type { OAuthAppSchema } from '$lib/api/generated/types.gen';
import DeveloperAppDangerZone from './DeveloperAppDangerZone.svelte';

function app(overrides: Partial<OAuthAppSchema> = {}): OAuthAppSchema {
	return {
		registration_source: 'manual',
		id: 'app-1',
		client_id: 'cid-1',
		name: 'Acme',
		description: '',
		client_type: 'confidential',
		allowed_scopes: ['openid'],
		homepage_url: '',
		privacy_policy_url: '',
		verified: false,
		is_active: true,
		redirect_uris: ['https://example.com/cb'],
		last_used_at: null,
		logo_url: null,
		connections_count: 0,
		...overrides
	};
}

function setup(overrides: Partial<OAuthAppSchema> = {}, busy = false) {
	const handlers = { onRotate: vi.fn(), onToggleActive: vi.fn(), onDelete: vi.fn() };
	render(DeveloperAppDangerZone, { props: { app: app(overrides), busy, ...handlers } });
	return handlers;
}

describe('DeveloperAppDangerZone', () => {
	it('is a labelled section whose buttons call their handlers', async () => {
		const { onRotate, onToggleActive, onDelete } = setup();
		expect(screen.getByRole('region', { name: 'Danger zone' })).toBeInTheDocument();
		const user = userEvent.setup();
		await user.click(screen.getByRole('button', { name: 'Rotate secret' }));
		await user.click(screen.getByRole('button', { name: 'Deactivate' }));
		await user.click(screen.getByRole('button', { name: 'Delete app' }));
		expect(onRotate).toHaveBeenCalledOnce();
		expect(onToggleActive).toHaveBeenCalledOnce();
		expect(onDelete).toHaveBeenCalledOnce();
	});

	it('hides Rotate for a public app (it has no secret)', () => {
		setup({ client_type: 'public' });
		expect(screen.queryByRole('button', { name: 'Rotate secret' })).toBeNull();
	});

	it('offers Activate for an inactive app', () => {
		setup({ is_active: false });
		expect(screen.getByRole('button', { name: 'Activate' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Deactivate' })).toBeNull();
	});

	it('disables every action while busy', () => {
		setup({}, true);
		for (const name of ['Rotate secret', 'Deactivate', 'Delete app'])
			expect(screen.getByRole('button', { name })).toBeDisabled();
	});
});
