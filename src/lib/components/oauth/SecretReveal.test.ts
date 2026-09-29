import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import SecretReveal from './SecretReveal.svelte';

vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('SecretReveal', () => {
	it('shows both values once with the warning and a done button', async () => {
		const onDone = vi.fn();
		render(SecretReveal, { props: { clientId: 'cid-1', clientSecret: 's3cret', onDone } });
		expect(screen.getByRole('textbox', { name: 'Client ID' })).toHaveValue('cid-1');
		expect(screen.getByRole('textbox', { name: 'Client secret' })).toHaveValue('s3cret');
		expect(screen.getByRole('alert')).toHaveTextContent("You won't see this again.");
		await userEvent.click(screen.getByRole('button', { name: "I've saved it" }));
		expect(onDone).toHaveBeenCalledOnce();
	});
});
