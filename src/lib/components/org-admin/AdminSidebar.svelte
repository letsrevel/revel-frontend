<script lang="ts">
	import { tick } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { PanelLeftClose, PanelLeftOpen } from '@lucide/svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { cn } from '$lib/utils';
	import { activeNavHref, type AdminNav, type NavItem } from './admin-nav';

	interface Props {
		nav: AdminNav;
		orgName: string;
		role: 'owner' | 'staff' | null;
		collapsed: boolean;
		onToggle: () => void;
		pathname: string;
	}

	const { nav, orgName, role, collapsed, onToggle, pathname }: Props = $props();

	const uid = $props.id();
	const navId = `admin-sidebar-nav-${uid}`;
	const toggleId = `admin-sidebar-toggle-${uid}`;
	const activeHref = $derived(activeNavHref(nav, pathname));
	const initial = $derived(orgName.trim().charAt(0).toUpperCase());
	const toggleLabel = $derived(
		collapsed ? m['orgAdmin.layout.expandSidebar']() : m['orgAdmin.layout.collapseSidebar']()
	);

	// The toggle is rendered from two different {#if collapsed} branches (with and without the
	// tooltip trigger), so the focused button is replaced on every toggle. Put focus back.
	async function handleToggle(): Promise<void> {
		onToggle();
		await tick();
		document.getElementById(toggleId)?.focus();
	}

	function linkClass(active: boolean): string {
		return cn(
			'relative flex items-center gap-3 rounded-md text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
			collapsed ? 'h-10 justify-center px-0' : 'px-3 py-2',
			// Active: text-primary on primary/10 over --background, audited in
			// scripts/audit-brand-themes.py: 5.29:1 light, 5.93:1 dark (needs 4.5).
			active
				? 'bg-primary/10 font-bold text-primary'
				: 'text-muted-foreground hover:bg-muted hover:text-foreground'
		);
	}
</script>

{#snippet itemLink(item: NavItem, triggerProps: Record<string, unknown> = {})}
	{@const Icon = item.icon}
	{@const active = item.href === activeHref}
	<!-- eslint-disable svelte/no-navigation-without-resolve -- href is a ResolvedPathname produced by resolve() in buildAdminNav -->
	<a
		{...triggerProps}
		href={item.href}
		class={linkClass(active)}
		aria-current={active ? 'page' : undefined}
	>
		<Icon class="h-4 w-4 shrink-0" aria-hidden="true" />
		<span class={collapsed ? 'sr-only' : 'min-w-0 truncate'}>{item.label}</span>
		{#if item.badge === 'warning'}
			<span
				class={cn(
					'h-2 w-2 shrink-0 rounded-full bg-destructive',
					collapsed ? 'absolute right-2 top-2' : 'ml-auto'
				)}
				role="status"
				aria-label={m['common.actionRequired']()}
			></span>
		{/if}
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{/snippet}

{#snippet entry(item: NavItem)}
	{#if collapsed}
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					{@render itemLink(item, props)}
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="right">{item.label}</Tooltip.Content>
		</Tooltip.Root>
	{:else}
		{@render itemLink(item)}
	{/if}
{/snippet}

<aside
	class={cn(
		'sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 flex-col border-r border-border bg-background motion-safe:transition-[width] motion-safe:duration-200 md:flex',
		collapsed ? 'w-16' : 'w-60'
	)}
>
	<Tooltip.Provider delayDuration={200}>
		<div class={cn('border-b border-border', collapsed ? 'flex justify-center p-3' : 'px-5 py-4')}>
			{#if collapsed}
				<span
					class="flex h-10 w-10 items-center justify-center rounded-md bg-primary font-black text-primary-foreground"
					aria-hidden="true">{initial}</span
				>
				<span class="sr-only">{orgName}</span>
			{:else}
				<p class="truncate text-base font-extrabold tracking-tight" title={orgName}>{orgName}</p>
				{#if role === 'owner'}
					<div class="mt-1.5">
						<StatusBadge tone="brand" label={m['orgAdminLayout.ownerBadge']()} size="sm" />
					</div>
				{:else if role === 'staff'}
					<div class="mt-1.5">
						<StatusBadge tone="neutral" label={m['orgAdmin.layout.staffBadge']()} size="sm" />
					</div>
				{/if}
			{/if}
		</div>

		<nav
			id={navId}
			aria-label={m['orgAdmin.layout.adminNavigation']()}
			class="flex-1 overflow-y-auto px-3 py-4"
		>
			{@render entry(nav.dashboard)}
			{#each nav.groups as group (group.id)}
				{@const labelId = `${navId}-${group.id}`}
				<p
					id={labelId}
					class={collapsed ? 'sr-only' : 'px-3 pb-1 pt-4 text-xs font-bold text-muted-foreground'}
				>
					{group.label}
				</p>
				{#if collapsed}
					<div class="mx-3 my-2 border-t border-border" aria-hidden="true"></div>
				{/if}
				<ul aria-labelledby={labelId} class="space-y-0.5">
					{#each group.items as item (item.id)}
						<li>{@render entry(item)}</li>
					{/each}
				</ul>
			{/each}
		</nav>

		<div class="border-t border-border p-3">
			{#snippet toggleButton(triggerProps: Record<string, unknown> = {})}
				<button
					{...triggerProps}
					id={toggleId}
					type="button"
					onclick={handleToggle}
					aria-expanded={!collapsed}
					aria-controls={navId}
					class={cn(
						'flex w-full items-center gap-3 rounded-md text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
						collapsed ? 'h-10 justify-center px-0' : 'px-3 py-2'
					)}
				>
					{#if collapsed}
						<PanelLeftOpen class="h-4 w-4 shrink-0" aria-hidden="true" />
					{:else}
						<PanelLeftClose class="h-4 w-4 shrink-0" aria-hidden="true" />
					{/if}
					<span class={collapsed ? 'sr-only' : ''}>{toggleLabel}</span>
				</button>
			{/snippet}
			{#if collapsed}
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							{@render toggleButton(props)}
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="right">{toggleLabel}</Tooltip.Content>
				</Tooltip.Root>
			{:else}
				{@render toggleButton()}
			{/if}
		</div>
	</Tooltip.Provider>
</aside>
