<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import type { OAuthAppSchema } from '$lib/api/generated/types.gen';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import { formatDateTime } from '$lib/utils/date';
	import AppLogo from './AppLogo.svelte';

	interface Props {
		app: OAuthAppSchema;
	}
	const { app }: Props = $props();

	const titleId = $props.id();
	const typeLabel = $derived(
		app.client_type === 'public'
			? m['oauth.developer.typePublic']()
			: m['oauth.developer.typeConfidential']()
	);
	// The catalog stores `usedBy` as nested one/other keys (two messages), so
	// pick the CLDR category for the active locale: fr/pt treat 0 as "one".
	const count = $derived(app.connections_count ?? 0);
	const usedBy = $derived(
		new Intl.PluralRules(getLocale()).select(count) === 'one'
			? m['oauth.developer.usedBy.one']({ count })
			: m['oauth.developer.usedBy.other']({ count })
	);
</script>

<article
	aria-labelledby={titleId}
	class="rounded-2xl border border-border bg-card p-4 text-card-foreground sm:p-5"
>
	<div class="flex items-start gap-3">
		<AppLogo name={app.name} logoUrl={app.logo_url ?? null} size="sm" />
		<div class="min-w-0 flex-1 space-y-2">
			<h3 id={titleId} class="break-words font-bold">
				<a
					href={resolve('/(auth)/account/developer-apps/[app_id]', { app_id: app.id })}
					class="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>{app.name}</a
				>
			</h3>
			<div class="flex flex-wrap items-center gap-2">
				<StatusBadge tone="neutral" label={typeLabel} size="sm" />
				<StatusBadge
					tone={app.is_active ? 'success' : 'neutral'}
					label={app.is_active ? m['oauth.developer.active']() : m['oauth.developer.inactive']()}
					size="sm"
				/>
				{#if app.verified}
					<StatusBadge tone="success" label={m['oauth.consent.verified']()} size="sm" />
				{/if}
			</div>
			<p class="text-sm text-muted-foreground">
				<span>{usedBy}</span>
				<span aria-hidden="true"> · </span>
				<span
					>{app.last_used_at
						? m['oauth.developer.lastUsed']({ date: formatDateTime(app.last_used_at) })
						: m['oauth.developer.neverUsed']()}</span
				>
			</p>
		</div>
	</div>
</article>
