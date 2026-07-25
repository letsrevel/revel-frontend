<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { toast } from 'svelte-sonner';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { organizationadminsubscriptionsMigratePlanSubscribers } from '$lib/api/generated/sdk.gen';
	import type {
		PlanSchema,
		MigrationAcceptedSchema,
		OrganizationAdminDetailSchema
	} from '$lib/api/generated/types.gen';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Loader2 } from '@lucide/svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { formatPlanPrice } from '$lib/utils/subscriptions';

	interface Props {
		organization: OrganizationAdminDetailSchema;
		plan: PlanSchema;
		open: boolean;
		onClose: () => void;
	}

	const { organization, plan, open, onClose }: Props = $props();
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	const migrateMut = createMutation(() => ({
		mutationFn: async () => {
			const res = await organizationadminsubscriptionsMigratePlanSubscribers({
				path: { slug: organization.slug, plan_id: plan.id ?? '' },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error(m['orgAdmin.members.plans.migrate.failed']());
			return res.data as MigrationAcceptedSchema;
		},
		onSuccess: (r: MigrationAcceptedSchema) => {
			toast.success(m['orgAdmin.members.plans.migrate.queued']({ count: r.queued }));
			// The migration mutates plan prices and every affected subscription —
			// refresh the plan list and the subscriptions list/metrics.
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'tier', plan.tier_id, 'plans']
			});
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'subscriptions']
			});
			onClose();
		},
		onError: (err: Error) => toast.error(err.message)
	}));

	function handleCancel() {
		if (!migrateMut.isPending) onClose();
	}
</script>

<Dialog {open} onOpenChange={handleCancel}>
	<DialogContent class="max-w-md">
		<DialogHeader>
			<DialogTitle>{m['orgAdmin.members.plans.migrate.title']()}</DialogTitle>
			<DialogDescription class="mt-1">
				{m['orgAdmin.members.plans.migrate.body']({
					count: plan.active_subscription_count,
					price: formatPlanPrice(plan)
				})}
			</DialogDescription>
		</DialogHeader>

		<DialogFooter>
			<Button variant="outline" onclick={handleCancel} disabled={migrateMut.isPending}>
				{m['tierForm.cancel']()}
			</Button>
			<Button onclick={() => migrateMut.mutate()} disabled={migrateMut.isPending}>
				{#if migrateMut.isPending}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{/if}
				{m['orgAdmin.members.plans.migrate.confirm']()}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
