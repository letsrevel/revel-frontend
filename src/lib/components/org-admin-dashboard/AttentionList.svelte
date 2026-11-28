<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { resolve } from '$app/paths';
	import { CircleCheck, TriangleAlert } from '@lucide/svelte';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import {
		orgHiddenWithPublicEvents,
		orgRequestsWhileRestricted
	} from '$lib/utils/admin-warnings/org';

	/** Same shape as `OrgWarningCounts` in `$lib/server/org-warning-counts` (server-only module). */
	interface WarningCounts {
		publicEventCount: number;
		inSeriesCount: number;
		partial: boolean;
	}

	interface Props {
		pendingRequestCount: number | null;
		billingNeedsAttention: boolean;
		draftCount: number | null;
		/** Pending subscriptions on offline plans (people owing a first payment). */
		awaitingPaymentCount?: number | null;
		orgSlug: string;
		isOwner: boolean;
		/** Visibility of the organization (A1, A4 rules). */
		orgVisibility?: string | null;
		/** Whether the organization accepts membership requests (A4 rule). */
		acceptMembershipRequests?: boolean | null;
		/** Upcoming public event counts for A1. `null` = unknown (hide the item). */
		warningCounts?: WarningCounts | null;
	}

	const {
		pendingRequestCount,
		billingNeedsAttention,
		draftCount,
		awaitingPaymentCount = null,
		orgSlug,
		isOwner,
		orgVisibility = null,
		acceptMembershipRequests = null,
		warningCounts = null
	}: Props = $props();

	interface Item {
		id: string;
		count: number | null;
		text: string;
		linkLabel: string;
		href: string;
	}

	const items = $derived.by((): Item[] => {
		const list: Item[] = [];
		if (pendingRequestCount !== null && pendingRequestCount > 0) {
			list.push({
				id: 'requests',
				count: pendingRequestCount,
				text: m['orgAdmin.dashboard.attention.membershipRequests']({ count: pendingRequestCount }),
				linkLabel: m['orgAdmin.dashboard.attention.review'](),
				href: `${resolve('/(auth)/org/[slug]/admin/members', { slug: orgSlug })}?tab=applications`
			});
		}
		if (awaitingPaymentCount !== null && awaitingPaymentCount > 0) {
			list.push({
				id: 'awaiting-payment',
				count: awaitingPaymentCount,
				text: m['orgAdmin.dashboard.attention.awaitingPayment']({ count: awaitingPaymentCount }),
				linkLabel: m['orgAdmin.dashboard.attention.review'](),
				href: `${resolve('/(auth)/org/[slug]/admin/members', { slug: orgSlug })}?tab=subscriptions&status=pending&payment_method=offline`
			});
		}
		if (isOwner && billingNeedsAttention) {
			list.push({
				id: 'billing',
				count: null,
				text: m['orgAdmin.dashboard.attention.billing'](),
				linkLabel: m['orgAdmin.dashboard.attention.fix'](),
				href: resolve('/(auth)/org/[slug]/admin/billing', { slug: orgSlug })
			});
		}
		if (draftCount !== null && draftCount > 0) {
			list.push({
				id: 'drafts',
				count: draftCount,
				text: m['orgAdmin.dashboard.attention.drafts']({ count: draftCount }),
				linkLabel: m['orgAdmin.dashboard.attention.open'](),
				href: resolve('/(auth)/org/[slug]/admin/events', { slug: orgSlug })
			});
		}
		const settingsHref = resolve('/(auth)/org/[slug]/admin/settings', { slug: orgSlug });
		// A1 (with the series sentence when it applies) and A4. Not A5: that one stays
		// on the settings and custom-domain pages.
		const hidden = warningCounts
			? orgHiddenWithPublicEvents({ orgVisibility, ...warningCounts })
			: null;
		if (hidden && warningCounts) {
			list.push({
				id: 'hidden-events',
				count: warningCounts.publicEventCount,
				text: hidden.message(),
				linkLabel: m['adminWarnings.attentionOpenSettings'](),
				href: `${settingsHref}#visibility`
			});
		}
		const requests = orgRequestsWhileRestricted({
			orgVisibility,
			accept_membership_requests: acceptMembershipRequests
		});
		if (requests) {
			list.push({
				id: 'requests-unreachable',
				count: null,
				text: requests.title(),
				linkLabel: m['adminWarnings.attentionOpenSettings'](),
				href: `${settingsHref}#accept_membership_requests`
			});
		}
		return list;
	});
</script>

<section class="space-y-3" aria-labelledby="attention-heading">
	<SectionHeader id="attention-heading" title={m['orgAdmin.dashboard.attention.heading']()} />

	{#if items.length > 0}
		<ul class="divide-y divide-border rounded-lg border border-border bg-card">
			{#each items as item (item.id)}
				<li class="flex items-center gap-4 p-4">
					<span
						class="inline-flex h-10 min-w-10 items-center justify-center rounded-md bg-highlight px-2 text-lg font-black tabular-nums text-highlight-foreground"
						aria-hidden="true"
					>
						{#if item.count !== null}
							{item.count}
						{:else}
							<TriangleAlert class="h-5 w-5" />
						{/if}
					</span>
					<p id="attention-{item.id}" class="flex-1 text-sm font-semibold">{item.text}</p>
					<!-- eslint-disable svelte/no-navigation-without-resolve -- href is built from resolve() above -->
					<a
						href={item.href}
						aria-describedby="attention-{item.id}"
						class="rounded-sm text-sm font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						{item.linkLabel}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</li>
			{/each}
		</ul>
	{:else}
		<p
			class="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"
		>
			<CircleCheck class="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
			{m['orgAdmin.dashboard.attention.allClear']()}
		</p>
	{/if}
</section>
