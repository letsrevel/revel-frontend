<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { organizationadminmembersListMembers } from '$lib/api/generated/sdk.gen';
	import type {
		OrganizationAdminDetailSchema,
		OrganizationMemberSchema
	} from '$lib/api/generated/types.gen';
	import { resolve } from '$app/paths';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import MemberStatusBadge from './MemberStatusBadge.svelte';
	import SubscriptionDrawer from './SubscriptionDrawer.svelte';

	interface Props {
		organization: OrganizationAdminDetailSchema;
		/** False while another tab is showing: no request fires. */
		active?: boolean;
		/** The drawer needs `manage_subscriptions`; without it the section is absent. */
		canManageSubscriptions?: boolean;
	}

	const { organization, active = true, canManageSubscriptions = false }: Props = $props();
	const accessToken = $derived(authStore.accessToken);
	const headingId = $props.id();
	const PAGE_SIZE = 100;

	// People held as `awaiting_payment` have no register entry yet (the backend
	// opens one at the first recorded payment), so the register list cannot show
	// them. The members list inlines each one's pending subscription id. The key
	// sits under `['organization', slug, 'members']`, which the subscription
	// drawer already invalidates on record/cancel.
	const query = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'members', 'awaiting-payment'],
		queryFn: async () => {
			const res = await organizationadminmembersListMembers({
				path: { slug: organization.slug },
				query: { status: 'awaiting_payment', page_size: PAGE_SIZE },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to load members awaiting payment');
			return res.data;
		},
		enabled: !!accessToken && active && canManageSubscriptions
	}));

	$effect(() => {
		if (query.error) console.warn('Awaiting-payment members unavailable', query.error);
	});

	const people = $derived<OrganizationMemberSchema[]>(
		(query.data?.results ?? []).filter((p) => !!p.subscription_id)
	);
	const total = $derived(query.data?.count ?? people.length);
	let drawerSubId = $state<string | null>(null);
	const seeAllHref = $derived(
		`${resolve('/(auth)/org/[slug]/admin/members', { slug: organization.slug })}?tab=subscriptions&status=pending&payment_method=offline`
	);
</script>

{#if canManageSubscriptions && people.length > 0}
	<section aria-labelledby={headingId} class="space-y-3 rounded-lg border bg-card p-4">
		<SectionHeader
			id={headingId}
			title={m['memberPeople.awaiting.title']({ count: total })}
			subtitle={m['memberPeople.awaiting.helper']()}
		/>
		<ul class="divide-y">
			{#each people as person (person.user.id ?? person.subscription_id)}
				<li class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
					<div class="min-w-0">
						<p class="truncate font-bold">{person.user.display_name}</p>
						{#if person.user.email}
							<p class="truncate text-sm text-muted-foreground">{person.user.email}</p>
						{/if}
					</div>
					<div class="flex flex-wrap items-center gap-3">
						{#if person.tier?.name}
							<span class="text-sm">{person.tier.name}</span>
						{/if}
						<MemberStatusBadge status="awaiting_payment" />
						<Button
							variant="outline"
							size="sm"
							aria-label={m['memberPeople.awaiting.recordFor']({
								name: person.user.display_name
							})}
							onclick={() => (drawerSubId = person.subscription_id ?? null)}
						>
							{m['memberPeople.awaiting.record']()}
						</Button>
					</div>
				</li>
			{/each}
		</ul>
		{#if total > people.length}
			<p class="text-sm text-muted-foreground">
				{m['memberPeople.awaiting.truncated']({ shown: people.length })}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- seeAllHref is resolve()d in the script, plus a query string -->
				<a
					href={seeAllHref}
					class="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>{m['memberPeople.awaiting.seeAll']()}</a
				>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</p>
		{/if}
	</section>
{/if}

{#if drawerSubId}
	<SubscriptionDrawer
		{organization}
		subId={drawerSubId}
		open={true}
		onClose={() => (drawerSubId = null)}
	/>
{/if}
