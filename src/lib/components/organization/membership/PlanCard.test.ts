import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import PlanCard from './PlanCard.svelte';
import type { PublicPlanSchema } from '$lib/api/generated/types.gen';

function makePlan(overrides: Partial<PublicPlanSchema> = {}): PublicPlanSchema {
	return {
		id: 'plan-1',
		tier_id: 'tier-1',
		tier_name: 'Gold',
		name: 'Monthly',
		description: null,
		price: '10.00',
		currency: 'EUR',
		period_unit: 'month',
		period_count: 1,
		payment_method: 'online',
		sales_status: 'open',
		sold_out: false,
		...overrides
	};
}

function renderCard(props: Record<string, unknown> = {}) {
	const onSubscribe = vi.fn();
	const result = render(PlanCard, {
		props: {
			plan: makePlan(),
			isAuthenticated: true,
			onSubscribe,
			organizationSlug: 'acme',
			...props
		}
	});
	return { ...result, onSubscribe };
}

describe('PlanCard', () => {
	it('shows the plan name, price and description', () => {
		renderCard({ plan: makePlan({ description: 'Two lines\nof perks' }) });

		expect(screen.getByRole('heading', { name: 'Monthly' })).toBeInTheDocument();
		expect(screen.getByText('€10.00 / month')).toBeInTheDocument();
		expect(screen.getByText(/two lines/i)).toBeInTheDocument();
	});

	// Offline plans are settled with the organizers directly — there is no
	// checkout to send the member to.
	it('explains an offline plan instead of offering a CTA', () => {
		const { onSubscribe } = renderCard({ plan: makePlan({ payment_method: 'offline' }) });

		expect(screen.getByText(/managed by the organization/i)).toBeInTheDocument();
		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.queryByRole('link')).toBeNull();
		expect(onSubscribe).not.toHaveBeenCalled();
	});

	it('labels a sold-out plan in text and withdraws the CTA', () => {
		renderCard({ plan: makePlan({ sold_out: true }) });

		expect(screen.getByText('Sold out')).toBeInTheDocument();
		expect(screen.getByText(/all spots are taken/i)).toBeInTheDocument();
		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.queryByRole('link')).toBeNull();
	});

	it('labels a paused plan in text and withdraws the CTA', () => {
		renderCard({ plan: makePlan({ sales_status: 'paused' }) });

		expect(screen.getByText('Sales paused')).toBeInTheDocument();
		expect(screen.getByText(/temporarily closed sign-ups/i)).toBeInTheDocument();
		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.queryByRole('link')).toBeNull();
	});

	it('hands the plan to the caller when a signed-in member subscribes', async () => {
		const user = userEvent.setup();
		const { onSubscribe } = renderCard();

		await user.click(screen.getByRole('button', { name: /subscribe/i }));

		expect(onSubscribe).toHaveBeenCalledTimes(1);
		expect(onSubscribe).toHaveBeenCalledWith(expect.objectContaining({ id: 'plan-1' }));
	});

	// A real anchor, not a scripted redirect: it survives no-JS and middle-click.
	it('sends a guest to the login page with a return URL back to the org', async () => {
		const user = userEvent.setup();
		const { onSubscribe } = renderCard({ isAuthenticated: false });

		const link = screen.getByRole('link', { name: /log in to subscribe/i });
		expect(link).toHaveAttribute('href', '/login?returnUrl=%2Forg%2Facme');
		expect(screen.queryByRole('button')).toBeNull();

		await user.click(link);
		expect(onSubscribe).not.toHaveBeenCalled();
	});

	// `id` is null for plans the backend will not accept a subscription for;
	// offering a CTA would only produce a failed checkout.
	it('renders no CTA for a plan without a server-side id', () => {
		renderCard({ plan: makePlan({ id: null }) });

		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.queryByRole('link')).toBeNull();
	});
});
