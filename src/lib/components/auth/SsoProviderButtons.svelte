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
				{#if provider.key === 'google'}
					<!-- Official "G" mark via the --brand-google-* tokens in app.css (exact
					     official hexes, mode-inert; imagery rule applies). -->
					<svg
						class="h-4 w-4 shrink-0"
						viewBox="0 0 18 18"
						aria-hidden="true"
						data-testid="sso-icon-google"
					>
						<path
							class="fill-[var(--brand-google-blue)]"
							d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
						/>
						<path
							class="fill-[var(--brand-google-green)]"
							d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
						/>
						<path
							class="fill-[var(--brand-google-yellow)]"
							d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
						/>
						<path
							class="fill-[var(--brand-google-red)]"
							d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
						/>
					</svg>
				{:else if provider.key === 'github'}
					<!-- GitHub Invertocat in currentColor (monochrome use is allowed by
					     GitHub's brand kit and adapts to both modes). -->
					<svg
						class="h-4 w-4 shrink-0"
						viewBox="0 0 24 24"
						fill="currentColor"
						aria-hidden="true"
						data-testid="sso-icon-github"
					>
						<path
							d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.084 1.84 1.236 1.84 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"
						/>
					</svg>
				{/if}
				{m['login.ssoContinueWith']({ name: provider.name })}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/each}
	</div>
{/if}
