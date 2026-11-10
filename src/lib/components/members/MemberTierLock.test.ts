import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import MemberAccessActions from './MemberAccessActions.svelte';
import type { MembershipTierSchema, OrganizationMemberSchema } from '$lib/api/generated/types.gen';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_API_URL: '' } }));
vi.mock('$lib/api/client', () => ({ client: {} }));

const sdk = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminmembersRemoveMember: vi.fn(),
	organizationadminmembersUpdateMember: sdk.update,
	organizationadminmembersAddStaff: vi.fn(),
	organizationadminblacklistCreateBlacklistEntry: vi.fn()
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast }));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'test-token' } }));

const tiers = [
	{ id: 't1', name: 'Gold' },
	{ id: 't2', name: 'Silver' }
] as MembershipTierSchema[];

function makeMember(overrides: Record<string, unknown> = {}): OrganizationMemberSchema {
	return {
		status: 'active',
		tier: null,
		member_since: '2026-01-01T00:00:00Z',
		subscription: null,
		tier_locked_by_subscription: false,
		subscription_id: null,
		user: {
			id: 'user-1',
			email: 'ada@example.com',
			first_name: 'Ada',
			last_name: 'Lovelace',
			preferred_name: 'Ada'
		},
		...overrides
	} as unknown as OrganizationMemberSchema;
}

const onClose = vi.fn();
const onManageSubscription = vi.fn();

function renderActions(member: OrganizationMemberSchema, withManage = true) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
	});
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: MemberAccessActions as never,
			componentProps: {
				slug: 'test-org',
				accessToken: 'test-token',
				member,
				tiers,
				isStaff: false,
				open: true,
				onClose,
				onManageSubscription: withManage ? onManageSubscription : undefined
			}
		}
	});
}

beforeAll(() => {
	const noop = (): void => {
		// no-op: jsdom has no layout and no pointer capture
	};
	if (typeof Element.prototype.hasPointerCapture !== 'function') {
		Element.prototype.hasPointerCapture = (): boolean => false;
		Element.prototype.setPointerCapture = noop;
		Element.prototype.releasePointerCapture = noop;
	}
	if (typeof Element.prototype.scrollIntoView !== 'function') {
		Element.prototype.scrollIntoView = noop;
	}
});

beforeEach(() => {
	document.body.style.pointerEvents = '';
	vi.clearAllMocks();
});

// jsdom never lays the select popover out, so floating-ui leaves it visibility:hidden.
async function pick(user: ReturnType<typeof userEvent.setup>, label: string, option: string) {
	await user.click(await screen.findByLabelText(label));
	const content = await waitFor(() => {
		const el = document.querySelector('[data-select-content]');
		if (!el) throw new Error('the select popover never opened');
		return el;
	});
	if (content.parentElement instanceof HTMLElement)
		content.parentElement.style.visibility = 'visible';
	await user.click(await screen.findByRole('option', { name: option }));
}

const REASON =
	"This member's tier follows their subscription plan. Change the plan in Manage subscription.";

describe('Manage membership: the tier follows the subscription plan', () => {
	it('leaves the tier select editable without a live subscription', async () => {
		renderActions(makeMember());
		expect(await screen.findByLabelText('Membership Tier')).toBeEnabled();
		expect(screen.queryByTestId('member-tier-lock')).not.toBeInTheDocument();
	});

	it('disables the tier select and explains why when a subscription owns the tier', async () => {
		renderActions(makeMember({ tier_locked_by_subscription: true, subscription_id: 'sub-1' }));
		const tier = await screen.findByLabelText('Membership Tier');
		expect(tier).toBeDisabled();
		expect(screen.getByText(REASON)).toBeInTheDocument();
	});

	it('links the reason to the select with aria-describedby', async () => {
		renderActions(makeMember({ tier_locked_by_subscription: true, subscription_id: 'sub-1' }));
		const tier = await screen.findByLabelText('Membership Tier');
		const reason = screen.getByText(REASON);
		expect(tier).toHaveAttribute('aria-describedby', reason.id);
		expect(reason.id).not.toBe('');
	});

	it('keeps the status editable while the tier is locked', async () => {
		renderActions(makeMember({ tier_locked_by_subscription: true, subscription_id: 'sub-1' }));
		expect(await screen.findByLabelText('Membership Status')).toBeEnabled();
	});

	it('does not point at "Manage subscription" when the viewer cannot open it', async () => {
		renderActions(
			makeMember({ tier_locked_by_subscription: true, subscription_id: 'sub-1' }),
			false
		);
		await screen.findByLabelText('Membership Tier');
		expect(screen.queryByText(REASON)).not.toBeInTheDocument();
		expect(
			screen.getByText(
				"This member's tier follows their subscription plan, so it can't be changed here."
			)
		).toBeInTheDocument();
		expect(screen.queryByTestId('member-tier-lock-manage-subscription')).not.toBeInTheDocument();
	});

	it('closes the dialog and hands over to the subscription', async () => {
		renderActions(makeMember({ tier_locked_by_subscription: true, subscription_id: 'sub-1' }));
		await userEvent.click(await screen.findByTestId('member-tier-lock-manage-subscription'));
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(onManageSubscription).toHaveBeenCalledTimes(1);
	});

	it('goes through the unsaved-changes guard first', async () => {
		const user = userEvent.setup();
		renderActions(makeMember({ tier_locked_by_subscription: true, subscription_id: 'sub-1' }));
		await pick(user, 'Membership Status', 'Paused');
		await user.click(await screen.findByTestId('member-tier-lock-manage-subscription'));
		expect(onClose).not.toHaveBeenCalled();
		expect(onManageSubscription).not.toHaveBeenCalled();
		await user.click(await screen.findByRole('button', { name: 'Discard' }));
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(onManageSubscription).toHaveBeenCalledTimes(1);
	});

	it('saves a status-only change while locked without sending a tier', async () => {
		const user = userEvent.setup();
		sdk.update.mockResolvedValue({ data: {}, error: undefined, response: { status: 200 } });
		renderActions(makeMember({ tier_locked_by_subscription: true, subscription_id: 'sub-1' }));
		await pick(user, 'Membership Status', 'Paused');
		await user.click(await screen.findByRole('button', { name: 'Save Changes' }));
		await waitFor(() => expect(sdk.update).toHaveBeenCalledTimes(1));
		expect(sdk.update.mock.calls[0][0].body).toEqual({ status: 'paused', tier_id: undefined });
	});

	it('shows the backend detail inline and locks the select after a 409 tier_follows_subscription', async () => {
		const user = userEvent.setup();
		sdk.update.mockResolvedValue({
			data: undefined,
			error: {
				detail: 'The tier follows the subscription plan.',
				code: 'tier_follows_subscription'
			},
			response: { status: 409 }
		});
		renderActions(makeMember());
		await pick(user, 'Membership Tier', 'Gold');
		await user.click(await screen.findByRole('button', { name: 'Save Changes' }));

		expect(await screen.findByText('The tier follows the subscription plan.')).toBeInTheDocument();
		expect(await screen.findByLabelText('Membership Tier')).toBeDisabled();
		expect(toast.error).not.toHaveBeenCalled();
		// The failed attempt is not left staged as an unsaved change.
		expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
	});

	it('still toasts any other refusal', async () => {
		const user = userEvent.setup();
		sdk.update.mockResolvedValue({
			data: undefined,
			error: { detail: 'Nope' },
			response: { status: 400 }
		});
		renderActions(makeMember());
		await pick(user, 'Membership Tier', 'Gold');
		await user.click(await screen.findByRole('button', { name: 'Save Changes' }));
		await waitFor(() => expect(toast.error).toHaveBeenCalled());
		await waitFor(() => expect(screen.getByLabelText('Membership Tier')).toBeEnabled());
	});
});
