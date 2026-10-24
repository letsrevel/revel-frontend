<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import type { Component } from 'svelte';
	import {
		Ban,
		BarChart3,
		Calendar,
		ClipboardList,
		Code,
		CreditCard,
		FolderOpen,
		Globe,
		MapPin,
		Megaphone,
		Plug,
		Repeat,
		ScanLine,
		Settings,
		Tag,
		Ticket,
		Users,
		Wallet
	} from '@lucide/svelte';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';

	interface Props {
		orgSlug: string;
		isOwner: boolean;
		canVerifyMembers: boolean;
		customDomainEnabled: boolean;
	}

	const { orgSlug, isOwner, canVerifyMembers, customDomainEnabled }: Props = $props();

	// The dashboard mounts this twice (side column on lg, after "Coming up"
	// below lg), so the heading id must be unique per instance.
	const uid = $props.id();
	const headingId = `admin-tools-heading-${uid}`;

	interface Tool {
		label: string;
		icon: Component;
		href: ResolvedPathname;
	}
	interface Group {
		id: string;
		title: string;
		tools: Tool[];
	}

	const groups: Group[] = $derived.by((): Group[] => {
		const slug = orgSlug;
		return [
			{
				id: 'events',
				title: m['orgAdmin.dashboard.tools.groups.events'](),
				tools: [
					{
						label: m['orgAdmin.nav.events'](),
						icon: Calendar,
						href: resolve('/(auth)/org/[slug]/admin/events', { slug })
					},
					{
						label: m['orgAdmin.nav.eventSeries'](),
						icon: Repeat,
						href: resolve('/(auth)/org/[slug]/admin/event-series', { slug })
					},
					{
						label: m['orgAdmin.nav.tickets'](),
						icon: Ticket,
						href: resolve('/(auth)/org/[slug]/admin/tickets', { slug })
					},
					{
						label: m['orgAdmin.nav.discountCodes'](),
						icon: Tag,
						href: resolve('/(auth)/org/[slug]/admin/discount-codes', { slug })
					}
				]
			},
			{
				id: 'people',
				title: m['orgAdmin.dashboard.tools.groups.people'](),
				tools: [
					{
						label: m['orgAdmin.nav.members'](),
						icon: Users,
						href: resolve('/(auth)/org/[slug]/admin/members', { slug })
					},
					// Gated on `check_in_attendees`, the same permission the backend's verify
					// endpoint requires. This is the ONLY entry point for a door steward who
					// holds nothing else: the Members page itself 403s them.
					...(canVerifyMembers
						? [
								{
									label: m['orgAdmin.dashboard.quickActions.verifyMembers.title'](),
									icon: ScanLine,
									href: resolve('/(auth)/org/[slug]/admin/members/verify', { slug })
								}
							]
						: []),
					{
						label: m['orgAdmin.dashboard.quickActions.blacklist.title'](),
						icon: Ban,
						href: resolve('/(auth)/org/[slug]/admin/blacklist', { slug })
					},
					{
						label: m['orgAdmin.nav.announcements'](),
						icon: Megaphone,
						href: resolve('/(auth)/org/[slug]/admin/announcements', { slug })
					}
				]
			},
			{
				id: 'content',
				title: m['orgAdmin.dashboard.tools.groups.content'](),
				tools: [
					{
						label: m['orgAdmin.nav.polls'](),
						icon: BarChart3,
						href: resolve('/(auth)/org/[slug]/admin/polls', { slug })
					},
					{
						label: m['orgAdmin.nav.questionnaires'](),
						icon: ClipboardList,
						href: resolve('/(auth)/org/[slug]/admin/questionnaires', { slug })
					},
					{
						label: m['orgAdmin.nav.resources'](),
						icon: FolderOpen,
						href: resolve('/(auth)/org/[slug]/admin/resources', { slug })
					}
				]
			},
			{
				id: 'organization',
				title: m['orgAdmin.dashboard.tools.groups.organization'](),
				tools: [
					{
						label: m['orgAdmin.nav.venues'](),
						icon: MapPin,
						href: resolve('/(auth)/org/[slug]/admin/venues', { slug })
					},
					{
						label: m['orgAdmin.nav.embed'](),
						icon: Code,
						href: resolve('/(auth)/org/[slug]/admin/embed', { slug })
					},
					{
						label: m['orgAdmin.nav.settings'](),
						icon: Settings,
						href: resolve('/(auth)/org/[slug]/admin/settings', { slug })
					},
					...(isOwner
						? [
								{
									label: m['orgAdmin.nav.billing'](),
									icon: CreditCard,
									href: resolve('/(auth)/org/[slug]/admin/billing', { slug })
								},
								{
									label: m['orgAdmin.nav.financials'](),
									icon: Wallet,
									href: resolve('/(auth)/org/[slug]/admin/financials', { slug })
								},
								{
									label: m['orgAdmin.nav.integrations'](),
									icon: Plug,
									href: resolve('/(auth)/org/[slug]/admin/integrations', { slug })
								},
								...(customDomainEnabled
									? [
											{
												label: m['orgAdmin.nav.customDomain'](),
												icon: Globe,
												href: resolve('/(auth)/org/[slug]/admin/custom-domain', { slug })
											}
										]
									: [])
							]
						: [])
				]
			}
		];
	});
</script>

<section class="space-y-4" aria-labelledby={headingId}>
	<SectionHeader id={headingId} title={m['orgAdmin.dashboard.tools.heading']()} />
	<div class="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4 lg:grid-cols-2">
		{#each groups as group (group.id)}
			<div>
				<h3 class="text-sm font-bold text-muted-foreground">{group.title}</h3>
				<ul class="mt-2 space-y-1">
					{#each group.tools as tool (tool.href)}
						{@const Icon = tool.icon}
						<li>
							<!-- eslint-disable svelte/no-navigation-without-resolve -- href is a ResolvedPathname produced by resolve() in the groups list above -->
							<a
								href={tool.href}
								class="inline-flex items-center gap-2 rounded-sm py-1.5 text-sm font-semibold hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<Icon class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
								{tool.label}
							</a>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
</section>
