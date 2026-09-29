import { render, screen, within } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ScopeCheckboxes from './ScopeCheckboxes.svelte';

const VOCAB = [
	{ name: 'openid', label: 'Sign you in', group: 'identity' as const },
	{ name: 'org:read', label: 'See your organizations', group: 'org' as const },
	{ name: 'org:events', label: 'Manage events', group: 'org' as const }
];

describe('ScopeCheckboxes', () => {
	it('renders grouped, labelled checkboxes reflecting value', () => {
		render(ScopeCheckboxes, {
			props: { value: ['org:read'], onChange: vi.fn(), vocabulary: VOCAB }
		});
		const org = screen.getByRole('group', { name: 'Your organizations' });
		expect(within(org).getByRole('checkbox', { name: 'See your organizations' })).toBeChecked();
		expect(within(org).getByRole('checkbox', { name: 'Manage events' })).not.toBeChecked();
		expect(
			within(org).getByText('Every organizer scope needs org:read as well.')
		).toBeInTheDocument();
		expect(screen.getByRole('group', { name: 'Sign in and profile' })).toBeInTheDocument();
	});

	it('toggles through onChange', async () => {
		const onChange = vi.fn();
		render(ScopeCheckboxes, { props: { value: ['org:read'], onChange, vocabulary: VOCAB } });
		await userEvent.click(screen.getByRole('checkbox', { name: 'Manage events' }));
		expect(onChange).toHaveBeenLastCalledWith(['org:read', 'org:events']);
		await userEvent.click(screen.getByRole('checkbox', { name: 'See your organizations' }));
		expect(onChange).toHaveBeenLastCalledWith([]);
	});

	it('shows a group-level error as an alert', () => {
		render(ScopeCheckboxes, {
			props: {
				value: ['org:events'],
				onChange: vi.fn(),
				vocabulary: VOCAB,
				error: 'Every organizer scope needs org:read as well.'
			}
		});
		expect(screen.getByRole('alert')).toHaveTextContent('org:read');
	});
});
