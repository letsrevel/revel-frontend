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
			{#if provider.key === 'google'}
				<!-- Google's sign-in button, rendered to the branding-guidelines spec
				     verbatim (simplifies Google brand verification — deliberately NO
				     app theming): 40px height, 4px radius, 12px side padding, 10px
				     logo-to-text gap, 14/20 Google Sans Medium, and the official
				     light/dark chrome via the --brand-google-* tokens in app.css.
				     The focus ring is ours (WCAG focus-visible requirement); it
				     doesn't alter the resting button. -->
				<a
					href={startUrl(provider.key)}
					class="inline-flex h-10 w-full items-center justify-center gap-2.5 rounded border border-[var(--brand-google-stroke)] bg-[var(--brand-google-fill)] px-3 text-sm font-medium leading-5 text-[var(--brand-google-text)] transition-shadow [font-family:'Google_Sans',sans-serif] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					<!-- Official 20×20 "G" — path data byte-for-byte from Google's
					     branding_guideline_sample assets (drawn at x 12–32 / y 10–30,
					     hence the offset viewBox). Colors are the exact official hexes
					     via tokens; identical in both modes, directly on the fill —
					     Google's own dark button does the same (no white tile). -->
					<svg
						class="h-5 w-5 shrink-0"
						viewBox="12 10 20 20"
						fill="none"
						aria-hidden="true"
						data-testid="sso-icon-google"
					>
						<path
							class="fill-[var(--brand-google-blue)]"
							d="M31.6 20.2273C31.6 19.5182 31.5364 18.8364 31.4182 18.1818H22V22.05H27.3818C27.15 23.3 26.4455 24.3591 25.3864 25.0682V27.5773H28.6182C30.5091 25.8364 31.6 23.2727 31.6 20.2273Z"
						/>
						<path
							class="fill-[var(--brand-google-green)]"
							d="M22 30C24.7 30 26.9636 29.1045 28.6181 27.5773L25.3863 25.0682C24.4909 25.6682 23.3454 26.0227 22 26.0227C19.3954 26.0227 17.1909 24.2636 16.4045 21.9H13.0636V24.4909C14.7091 27.7591 18.0909 30 22 30Z"
						/>
						<path
							class="fill-[var(--brand-google-yellow)]"
							d="M16.4045 21.9C16.2045 21.3 16.0909 20.6591 16.0909 20C16.0909 19.3409 16.2045 18.7 16.4045 18.1V15.5091H13.0636C12.3864 16.8591 12 18.3864 12 20C12 21.6136 12.3864 23.1409 13.0636 24.4909L16.4045 21.9Z"
						/>
						<path
							class="fill-[var(--brand-google-red)]"
							d="M22 13.9773C23.4681 13.9773 24.7863 14.4818 25.8227 15.4727L28.6909 12.6045C26.9591 10.9909 24.6954 10 22 10C18.0909 10 14.7091 12.2409 13.0636 15.5091L16.4045 18.1C17.1909 15.7364 19.3954 13.9773 22 13.9773Z"
						/>
					</svg>
					{m['login.ssoContinueWith']({ name: provider.name })}
				</a>
			{:else}
				<a
					href={startUrl(provider.key)}
					class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					{#if provider.key === 'github'}
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
			{/if}
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/each}
	</div>
{/if}
