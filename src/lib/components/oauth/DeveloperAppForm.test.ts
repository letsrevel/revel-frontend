import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import DeveloperAppForm from './DeveloperAppForm.svelte';

const VOCAB = [
	{ name: 'openid', label: 'Sign you in', group: 'identity' as const },
	{ name: 'org:read', label: 'See your organizations', group: 'org' as const },
	{ name: 'org:events', label: 'Manage events', group: 'org' as const }
];

async function fillMinimal() {
	await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Acme');
	await userEvent.type(
		screen.getByRole('textbox', { name: 'Redirect URI 1' }),
		'https://acme.example/cb'
	);
}

describe('DeveloperAppForm create', () => {
	it('pre-checks org:read, shows the client type radio and submits validated values', async () => {
		const onSubmit = vi.fn();
		render(DeveloperAppForm, { props: { mode: 'create', vocabulary: VOCAB, onSubmit } });
		expect(screen.getByRole('checkbox', { name: /See your organizations/ })).toBeChecked();
		expect(screen.getByRole('radio', { name: /Public/ })).toBeChecked();
		await fillMinimal();
		await userEvent.click(screen.getByRole('button', { name: 'Register app' }));
		expect(onSubmit).toHaveBeenCalledWith({
			name: 'Acme',
			description: '',
			client_type: 'public',
			redirect_uris: ['https://acme.example/cb'],
			allowed_scopes: ['org:read'],
			homepage_url: '',
			privacy_policy_url: ''
		});
	});

	it('blocks submit on a bad URI and shows the row error; confidential rejects http loopback', async () => {
		const onSubmit = vi.fn();
		render(DeveloperAppForm, { props: { mode: 'create', vocabulary: VOCAB, onSubmit } });
		await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Acme');
		await userEvent.click(screen.getByRole('radio', { name: /Confidential/ }));
		await userEvent.type(
			screen.getByRole('textbox', { name: 'Redirect URI 1' }),
			'http://127.0.0.1:47123/cb'
		);
		await userEvent.click(screen.getByRole('button', { name: 'Register app' }));
		expect(onSubmit).not.toHaveBeenCalled();
		expect(screen.getByRole('textbox', { name: 'Redirect URI 1' })).toHaveAttribute(
			'aria-invalid',
			'true'
		);
		// The confidential hint above the list carries the same sentence, so assert the
		// row's own error via its accessible description rather than a page-wide getByText.
		expect(screen.getByRole('textbox', { name: 'Redirect URI 1' })).toHaveAccessibleDescription(
			'Confidential apps must use https.'
		);
	});

	it('enforces org:read when another org scope is checked', async () => {
		const onSubmit = vi.fn();
		render(DeveloperAppForm, { props: { mode: 'create', vocabulary: VOCAB, onSubmit } });
		await fillMinimal();
		await userEvent.click(screen.getByRole('checkbox', { name: /See your organizations/ }));
		await userEvent.click(screen.getByRole('checkbox', { name: /Manage events/ }));
		await userEvent.click(screen.getByRole('button', { name: 'Register app' }));
		expect(onSubmit).not.toHaveBeenCalled();
		expect(screen.getByRole('alert')).toHaveTextContent('org:read');
	});

	it('shows server field and form errors and disables while submitting', () => {
		render(DeveloperAppForm, {
			props: {
				mode: 'create',
				vocabulary: VOCAB,
				onSubmit: vi.fn(),
				submitting: true,
				formError: "You've reached the limit of apps per account.",
				fieldErrors: { name: 'Taken' }
			}
		});
		expect(screen.getByRole('button', { name: /Saving|Register app/ })).toBeDisabled();
		expect(screen.getByText("You've reached the limit of apps per account.")).toBeInTheDocument();
		expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('aria-invalid', 'true');
	});
});

describe('DeveloperAppForm edit', () => {
	it('hides the client type, prefills from initial and submits the edited values', async () => {
		const onSubmit = vi.fn();
		render(DeveloperAppForm, {
			props: {
				mode: 'edit',
				vocabulary: VOCAB,
				onSubmit,
				initial: {
					name: 'Acme',
					description: 'Old',
					client_type: 'confidential',
					redirect_uris: ['https://acme.example/cb'],
					allowed_scopes: ['openid'],
					homepage_url: '',
					privacy_policy_url: ''
				}
			}
		});
		expect(screen.queryByRole('radio')).toBeNull();
		const description = screen.getByRole('textbox', { name: 'Description' });
		await userEvent.clear(description);
		await userEvent.type(description, 'New');
		await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ description: 'New', client_type: 'confidential' })
		);
	});
});
