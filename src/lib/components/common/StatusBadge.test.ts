import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import { CircleCheck } from '@lucide/svelte';
import StatusBadge from './StatusBadge.svelte';

describe('StatusBadge', () => {
	it('renders the label text', () => {
		render(StatusBadge, { props: { tone: 'success', label: 'Confirmed' } });
		expect(screen.getByText('Confirmed')).toBeInTheDocument();
	});

	it('applies the solid token classes for its tone', () => {
		const { container } = render(StatusBadge, { props: { tone: 'danger', label: 'Cancelled' } });
		const el = container.querySelector('span') as HTMLElement;
		expect(el.className).toContain('bg-destructive');
		expect(el.className).toContain('text-destructive-foreground');
	});

	it('renders an optional icon as decorative', () => {
		const { container } = render(StatusBadge, {
			props: { tone: 'success', label: 'Paid', icon: CircleCheck }
		});
		const svg = container.querySelector('svg');
		expect(svg).not.toBeNull();
		expect(svg?.getAttribute('aria-hidden')).toBe('true');
	});

	it('passes through title and role via restProps', () => {
		const { container } = render(StatusBadge, {
			props: { tone: 'success', label: 'Confirmed', title: 'RSVP confirmed', role: 'status' }
		});
		const el = container.querySelector('span') as HTMLElement;
		expect(el.getAttribute('title')).toBe('RSVP confirmed');
		expect(el.getAttribute('role')).toBe('status');
	});

	// --- accessible name (#788) ---
	// The mappers each pass `aria-label={label}` and each pin it with an
	// enum-driven guard test. Those guards exist because forgetting the prop in
	// ONE mapper un-named every subscription pill and took 19 e2e specs with it
	// (#772). The default below is what makes forgetting it harmless; these four
	// cases are its contract.

	it('defaults the accessible name to the visible label', () => {
		const { container } = render(StatusBadge, { props: { tone: 'success', label: 'Active' } });
		const el = container.querySelector('span') as HTMLElement;
		expect(el.getAttribute('aria-label')).toBe('Active');
		expect(screen.getByLabelText('Active')).toBeInTheDocument();
		// The name is an alias for what is on screen, never a substitute for it.
		expect(screen.getByLabelText('Active')).toHaveTextContent('Active');
	});

	it('lets an explicit aria-label from the caller win over the default', () => {
		const { container } = render(StatusBadge, {
			props: { tone: 'success', label: 'Active', 'aria-label': 'Membership status: Active' }
		});
		const el = container.querySelector('span') as HTMLElement;
		expect(el.getAttribute('aria-label')).toBe('Membership status: Active');
		expect(screen.queryByLabelText('Active')).toBeNull();
	});

	// The escape hatch. `aria-label={undefined}` is an explicit OPT-OUT, not a
	// request for the default — `account/MembershipPaymentHistory` relies on it to
	// stay out of the way of a `getByLabel` lookup scoped to the same card.
	it('emits no aria-label when the caller passes undefined explicitly', () => {
		const { container } = render(StatusBadge, {
			props: { tone: 'warning', label: 'Pending', 'aria-label': undefined }
		});
		const el = container.querySelector('span') as HTMLElement;
		expect(el.hasAttribute('aria-label')).toBe(false);
		expect(el).toHaveTextContent('Pending');
	});

	// An empty name would turn axe's `aria-prohibited-attr` from `incomplete`
	// (needs-review, which the e2e a11y smoke ignores) into a SERIOUS violation,
	// because the span would then carry a prohibited attribute and no text.
	it('emits no aria-label for an empty label', () => {
		const { container } = render(StatusBadge, { props: { tone: 'neutral', label: '' } });
		const el = container.querySelector('span') as HTMLElement;
		expect(el.hasAttribute('aria-label')).toBe(false);
	});

	it('lg size applies the larger padding classes', () => {
		const { container } = render(StatusBadge, {
			props: { tone: 'brand', label: 'Big', size: 'lg' }
		});
		const el = container.querySelector('span') as HTMLElement;
		expect(el.className).toContain('px-3');
	});
});
