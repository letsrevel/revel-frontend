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

	// --- the accessible name (#795) ---
	// The ruling: a badge is text, so its name is its content. `aria-label` is
	// gone from the public type — on a role-less <span> the implicit `generic`
	// role does not support name-from-author, so every name the primitive used to
	// emit was reaching Playwright and no assistive technology at all.

	it('emits no ARIA at all for the ordinary case', () => {
		const { container } = render(StatusBadge, { props: { tone: 'success', label: 'Active' } });
		const el = container.querySelector('span') as HTMLElement;
		expect(el.hasAttribute('aria-label')).toBe(false);
		expect(el.hasAttribute('role')).toBe(false);
		expect(container.querySelector('[aria-hidden]')).toBeNull();
		expect(el).toHaveTextContent('Active');
	});

	it('exposes the data-testid automation hook', () => {
		const { container } = render(StatusBadge, { props: { tone: 'success', label: 'Active' } });
		const el = container.querySelector('span') as HTMLElement;
		expect(el.getAttribute('data-testid')).toBe('status-badge');
	});

	// The dedicated hook `account/MembershipCard` uses so a pending SUBSCRIPTION
	// and a pending PAYMENT in the same card stay addressable apart.
	it('lets a call site override the data-testid', () => {
		const { container } = render(StatusBadge, {
			props: { tone: 'warning', label: 'Pending', 'data-testid': 'membership-subscription-status' }
		});
		const el = container.querySelector('span') as HTMLElement;
		expect(el.getAttribute('data-testid')).toBe('membership-subscription-status');
	});

	// --- srLabel ---

	it('renders srLabel as sr-only content and hides the duplicated visible label', () => {
		const { container } = render(StatusBadge, {
			props: { tone: 'success', label: 'Verified', srLabel: 'Email is verified' }
		});
		const srOnly = container.querySelector('.sr-only') as HTMLElement;
		expect(srOnly).not.toBeNull();
		expect(srOnly).toHaveTextContent('Email is verified');

		// The visible text stays on screen, and stays out of the announcement, so
		// the badge reads "Email is verified" rather than "Email is verified
		// Verified".
		const visible = screen.getByText('Verified');
		expect(visible).toBeInTheDocument();
		expect(visible.getAttribute('aria-hidden')).toBe('true');

		// Still no prohibited attribute: the name comes from content either way.
		const el = container.querySelector('span') as HTMLElement;
		expect(el.hasAttribute('aria-label')).toBe(false);
	});

	it('leaves the visible label exposed when there is no srLabel', () => {
		render(StatusBadge, { props: { tone: 'neutral', label: 'Draft' } });
		expect(screen.getByText('Draft').hasAttribute('aria-hidden')).toBe(false);
	});

	// `filter({ hasText })` in the e2e suite matches on textContent, which is a
	// superset of both strings — this pins that.
	it('keeps textContent a superset of both label and srLabel', () => {
		const { container } = render(StatusBadge, {
			props: { tone: 'success', label: 'Active', srLabel: 'Membership status: Active' }
		});
		const el = container.querySelector('span') as HTMLElement;
		expect(el.textContent).toContain('Membership status: Active');
		expect(el.textContent).toContain('Active');
	});

	it('lg size applies the larger padding classes', () => {
		const { container } = render(StatusBadge, {
			props: { tone: 'brand', label: 'Big', size: 'lg' }
		});
		const el = container.querySelector('span') as HTMLElement;
		expect(el.className).toContain('px-3');
	});
});
