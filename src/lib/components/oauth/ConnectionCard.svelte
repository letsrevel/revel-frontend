<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { AuthorizeScopeSchema, OAuthConnectionSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import { formatDate, formatDateTime } from '$lib/utils/date';
	import { rowsFor } from '$lib/utils/oauth-scopes';
	import AppLogo from './AppLogo.svelte';
	import ScopeList from './ScopeList.svelte';

	interface Props {
		connection: OAuthConnectionSchema;
		/** The whole scope vocabulary (labels are the backend's, already translated). */
		vocabulary: AuthorizeScopeSchema[];
		/** The page owns the confirm dialog; the card only asks. */
		onRemove: (connection: OAuthConnectionSchema) => void;
		removing?: boolean;
	}
	const { connection, vocabulary, onRemove, removing = false }: Props = $props();

	const titleId = $props.id();
	const app = $derived(connection.application);
	// Wire order is alphabetical; the vocabulary order reads as the consent screen did.
	const rows = $derived(rowsFor(connection.scopes, vocabulary));
</script>

<article
	aria-labelledby={titleId}
	class="space-y-4 rounded-2xl border border-border bg-card p-4 text-card-foreground sm:p-5"
>
	<div class="flex items-start gap-3">
		<AppLogo name={app.name} logoUrl={app.logo_url ?? null} size="sm" />
		<div class="min-w-0 flex-1">
			<div class="flex flex-wrap items-center gap-2">
				<h3 id={titleId} class="break-words font-bold">{app.name}</h3>
				{#if app.verified}
					<StatusBadge tone="success" label={m['oauth.consent.verified']()} size="sm" />
				{/if}
			</div>
			<p class="mt-1 text-sm text-muted-foreground">
				<span
					>{m['oauth.connections.connectedOn']({
						date: formatDate(connection.first_authorized_at)
					})}</span
				>
				<span aria-hidden="true"> · </span>
				<span
					>{m['oauth.connections.lastUsed']({
						date: formatDateTime(connection.last_used_at)
					})}</span
				>
			</p>
		</div>
		<Button
			type="button"
			variant="outline"
			size="sm"
			disabled={removing}
			onclick={() => onRemove(connection)}
			class="shrink-0"
		>
			<span aria-hidden="true">{m['oauth.connections.remove']()}</span>
			<span class="sr-only">{m['oauth.connections.removeNamed']({ name: app.name })}</span>
		</Button>
	</div>

	<ScopeList scopes={rows} variant="compact" class="text-sm" />
</article>
