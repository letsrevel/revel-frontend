<script lang="ts">
	import type { SsoProviderSchema } from '$lib/api/generated/types.gen';
	import { API_BASE_URL } from '$lib/config/api';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		providers: SsoProviderSchema[];
		/** Relative path to return to after login; validated again server-side. */
		returnUrl?: string | null;
	}

	let { providers, returnUrl = null }: Props = $props();

	function startUrl(key: string): string {
		const base = `${API_BASE_URL}/api/auth/oidc/${encodeURIComponent(key)}/start`;
		return returnUrl ? `${base}?return_url=${encodeURIComponent(returnUrl)}` : base;
	}
</script>

{#if providers.length > 0}
	<div class="space-y-3">
		<div class="flex items-center gap-3">
			<div class="h-px flex-1 bg-border" aria-hidden="true"></div>
			<span class="text-xs uppercase tracking-wide text-muted-foreground">
				{m['login.ssoDivider']()}
			</span>
			<div class="h-px flex-1 bg-border" aria-hidden="true"></div>
		</div>
		{#each providers as provider (provider.key)}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- external URL: browser navigation to the backend's OIDC start endpoint -->
			<a
				href={startUrl(provider.key)}
				class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				{m['login.ssoContinueWith']({ name: provider.name })}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/each}
	</div>
{/if}
