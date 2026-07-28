import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import TiersTab from './TiersTab.svelte';
import type {
	MembershipTierAdminSchema,
	OrganizationAdminDetailSchema,
	OrganizationMemberSchema,
	OrganizationQuestionnaireInListSchema
} from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminmembersCreateMembershipTier: vi.fn(),
	organizationadminmembersUpdateMembershipTier: vi.fn(),
	organizationadminmembersDeleteMembershipTier: vi.fn(),
	organizationadminmembersReorderMembershipTiers: vi.fn()
}));
import { organizationadminmembersDeleteMembershipTier } from '$lib/api/generated/sdk.gen';

vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { toast } from 'svelte-sonner';

vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'test-token' } }));

const organization = { slug: 'test-org' } as unknown as OrganizationAdminDetailSchema;

const tiers = [
	{ id: 'tier-1', name: 'Gold', description: null }
] as unknown as MembershipTierAdminSchema[];

function renderTab() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
	});
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: TiersTab,
			componentProps: {
				organization,
				tiers,
				members: [] as OrganizationMemberSchema[],
				isLoading: false,
				isError: false,
				membershipQuestionnaires: [] as OrganizationQuestionnaireInListSchema[],
				orgDefaultRequiresApproval: false
			}
		}
	});
	// Handed back so cache-invalidation assertions can spy on the very client the
	// component under test is wired to.
	return { client };
}

/** Opens the confirm dialog and presses its destructive button. */
async function confirmDelete(user: ReturnType<typeof userEvent.setup>) {
	await user.click(await screen.findByRole('button', { name: 'Delete Gold' }));
	await user.click(await screen.findByRole('button', { name: 'Delete Tier' }));
}

// bits-ui pins pointer-events on <body> while a dialog is open; jsdom keeps
// <body> across tests, so reset it or a test that ends with a dialog open
// poisons every later click.
beforeEach(() => {
	document.body.style.pointerEvents = '';
	vi.clearAllMocks();
});

describe('TiersTab delete', () => {
	it('toasts the backend detail verbatim when the delete is refused with a 409', async () => {
		const user = userEvent.setup();
		const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
		vi.mocked(organizationadminmembersDeleteMembershipTier).mockResolvedValue({
			data: undefined,
			error: { detail: 'A membership application still references this tier.' },
			response: { status: 409 }
		} as never);

		renderTab();
		await confirmDelete(user);

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith(
				'A membership application still references this tier.'
			);
		});
		// The 409 sentence arrives already translated — a native alert would both
		// bypass the toast surface and block the page.
		expect(alertSpy).not.toHaveBeenCalled();
	});

	it('keeps the confirm dialog open after a refusal so the tier can still be kept', async () => {
		const user = userEvent.setup();
		vi.mocked(organizationadminmembersDeleteMembershipTier).mockResolvedValue({
			data: undefined,
			error: { detail: 'A subscription still references this tier.' },
			response: { status: 409 }
		} as never);

		renderTab();
		await confirmDelete(user);

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalled();
		});
		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});

	it('falls back to localized copy when the delete error carries no detail', async () => {
		const user = userEvent.setup();
		vi.mocked(organizationadminmembersDeleteMembershipTier).mockResolvedValue({
			data: undefined,
			error: {}
		} as never);

		renderTab();
		await confirmDelete(user);

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith('Could not delete this tier.');
		});
	});

	it('invalidates tiers and members and closes the dialog on a 204', async () => {
		const user = userEvent.setup();
		vi.mocked(organizationadminmembersDeleteMembershipTier).mockResolvedValue({
			data: undefined,
			error: undefined,
			response: { status: 204 }
		} as never);

		const { client } = renderTab();
		const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

		await confirmDelete(user);

		await waitFor(() => {
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ['organization', 'test-org', 'membership-tiers']
			});
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ['organization', 'test-org', 'members']
		});
		await waitFor(() => {
			expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		});
		expect(toast.error).not.toHaveBeenCalled();
	});
});
