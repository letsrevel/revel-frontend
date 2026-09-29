<script lang="ts">
	import { Banknote } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { AuthorizeScopeSchema } from '$lib/api/generated/types.gen';
	import { cn } from '$lib/utils';
	import { groupHeading, groupScopes, involvesMoney } from '$lib/utils/oauth-scopes';

	interface Props {
		/** Backend rows; labels are rendered as-is (already translated). */
		scopes: AuthorizeScopeSchema[];
		/** grouped = consent screen (sections + headings); compact = one plain list. */
		variant?: 'grouped' | 'compact';
		class?: string;
	}
	const { scopes, variant = 'grouped', class: className = '' }: Props = $props();

	const groups = $derived(groupScopes(scopes));
	const uid = $props.id();
</script>

{#snippet row(scope: AuthorizeScopeSchema)}
	<li class="flex items-start gap-2">
		<span>{scope.label}</span>
		{#if involvesMoney(scope.name)}
			<Banknote class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
			<span class="sr-only">({m['oauth.scopes.moneyMarker']()})</span>
		{/if}
	</li>
{/snippet}

{#if scopes.length > 0}
	{#if variant === 'grouped'}
		<div class={cn('space-y-4', className)}>
			{#each groups as group (group.group)}
				<section aria-labelledby="{uid}-{group.group}">
					<h2
						id="{uid}-{group.group}"
						class="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
					>
						{groupHeading(group.group)}
					</h2>
					<ul role="list" class="mt-2 space-y-1.5">
						{#each group.rows as scope (scope.name)}
							{@render row(scope)}
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	{:else}
		<ul role="list" class={cn('space-y-1.5', className)}>
			{#each scopes as scope (scope.name)}
				{@render row(scope)}
			{/each}
		</ul>
	{/if}
{/if}
