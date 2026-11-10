<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { onDestroy, tick } from 'svelte';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { CreditCard, Plus } from '@lucide/svelte';
	import { organizationadminsubscriptionsCreateSubscription } from '$lib/api/generated/sdk.gen';
	import type {
		OrganizationAdminDetailSchema,
		OrganizationMemberSchema,
		SubscriptionCreateSchema,
		SubscriptionSchema
	} from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import SubscriptionDrawer from '$lib/components/members/SubscriptionDrawer.svelte';
	import SubscriptionCreateModal from '$lib/components/members/SubscriptionCreateModal.svelte';
	import { backendMessage } from '$lib/utils/api-error-detail';
	import { invalidateAfterMemberWrite } from '$lib/member-register/member-access';

	// Chaining one Dialog open after another's close in the same tick leaves
	// `pointer-events: none` stuck on <body> (see SubscriptionsTab); wait it out.
	const DIALOG_CLOSE_MS = 250;

	/**
	 * "Manage subscription" / "Add subscription" for one member of the person
	 * sheet. A live subscription opens the same drawer the Subscriptions tab uses,
	 * as a modal on top of the sheet; without one the create modal opens with this
	 * member already chosen. The parent can also open the drawer through
	 * `openManage()` (the tier-lock link of the Manage membership dialog).
	 */
	interface Props {
		organization: OrganizationAdminDetailSchema;
		accessToken: string | null | undefined;
		member: OrganizationMemberSchema;
	}

	const { organization, accessToken, member }: Props = $props();
	const queryClient = useQueryClient();

	const liveSubscriptionId = $derived(member.subscription_id ?? null);

	// The drawer stays mounted once it has an id so its close animation and the
	// focus return run; `drawerOpen` is what actually shows it.
	let drawerSubId = $state<string | null>(null);
	let drawerOpen = $state(false);
	let createOpen = $state(false);
	let createError = $state<string | null>(null);
	let trigger = $state<HTMLElement | null>(null);
	let openTimer: ReturnType<typeof setTimeout> | undefined;
	onDestroy(() => clearTimeout(openTimer));

	/** Open the drawer of the member's live subscription (no-op without one). */
	export function openManage(): void {
		const id = liveSubscriptionId;
		if (!id) return;
		clearTimeout(openTimer);
		// Wait out the closing Manage membership dialog before opening the next.
		openTimer = setTimeout(() => {
			drawerSubId = id;
			drawerOpen = true;
		}, DIALOG_CLOSE_MS);
	}

	function onPrimary(): void {
		if (liveSubscriptionId) {
			drawerSubId = liveSubscriptionId;
			drawerOpen = true;
		} else {
			createError = null;
			createOpen = true;
		}
	}

	async function closeDrawer(): Promise<void> {
		drawerOpen = false;
		// A pause, a payment or a plan change moves the sheet's tier, status and
		// subscription line: refresh everything the member write refreshes.
		void invalidateAfterMemberWrite(queryClient, organization.slug);
		await tick();
		trigger?.focus();
	}

	const createMut = createMutation(() => ({
		mutationFn: async (payload: SubscriptionCreateSchema) => {
			const res = await organizationadminsubscriptionsCreateSubscription({
				path: { slug: organization.slug },
				body: payload,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) {
				throw new Error(backendMessage(res.error) ?? 'Failed to create subscription');
			}
			return res.data as SubscriptionSchema;
		},
		onSuccess: (sub) => {
			void invalidateAfterMemberWrite(queryClient, organization.slug);
			createOpen = false;
			const id = sub.id ?? null;
			clearTimeout(openTimer);
			openTimer = setTimeout(() => {
				if (!id) return;
				drawerSubId = id;
				drawerOpen = true;
			}, DIALOG_CLOSE_MS);
		},
		onError: (err: Error) => (createError = err.message)
	}));
</script>

<Button
	bind:ref={trigger}
	variant="outline"
	onclick={onPrimary}
	data-testid="person-manage-subscription"
>
	{#if liveSubscriptionId}
		<CreditCard aria-hidden="true" />
		{m['memberPeople.sheet.manageSubscription']()}
	{:else}
		<Plus aria-hidden="true" />
		{m['memberPeople.sheet.addSubscription']()}
	{/if}
</Button>

<SubscriptionCreateModal
	{organization}
	open={createOpen}
	fixedMember={member}
	onClose={() => {
		createOpen = false;
		createError = null;
	}}
	onSubmit={(p) => {
		createError = null;
		createMut.mutate(p);
	}}
	submitError={createError}
	isSubmitting={createMut.isPending}
/>

{#if drawerSubId}
	<SubscriptionDrawer
		{organization}
		subId={drawerSubId}
		open={drawerOpen}
		onClose={() => void closeDrawer()}
	/>
{/if}
