<script lang="ts">
	import { ShieldAlert } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { AuthorizeAppSchema, AuthorizeScopeSchema } from '$lib/api/generated/types.gen';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import { isHttpUrl } from '$lib/utils/navigate-to';
	import AppLogo from './AppLogo.svelte';
	import ScopeList from './ScopeList.svelte';

	interface Props {
		application: AuthorizeAppSchema;
		scopes: AuthorizeScopeSchema[];
		redirectUri: string;
	}
	const { application, scopes, redirectUri }: Props = $props();

	/** Host of an http(s) URL, or null when it is empty, another scheme or unparseable. */
	function hostOf(url: string): string | null {
		if (!url || !isHttpUrl(url) || !/^https?:/i.test(url)) return null;
		try {
			return new URL(url).host;
		} catch {
			return null;
		}
	}

	const homepageHost = $derived(hostOf(application.homepage_url));
	const privacyHost = $derived(hostOf(application.privacy_policy_url));
	const redirectHost = $derived(hostOf(redirectUri));
</script>

<div class="space-y-6 rounded-2xl border border-border bg-card p-6 text-card-foreground">
	<div class="flex items-start gap-4">
		<AppLogo name={application.name} logoUrl={application.logo_url ?? null} size="lg" />
		<div class="min-w-0 flex-1 space-y-2">
			<div class="flex flex-wrap items-center gap-2">
				<p class="break-words text-lg font-bold">{application.name}</p>
				{#if application.verified}
					<StatusBadge tone="success" label={m['oauth.consent.verified']()} size="sm" />
				{/if}
			</div>
			{#if application.description}
				<p class="whitespace-pre-line break-words text-sm text-muted-foreground">
					{application.description}
				</p>
			{/if}
			{#if homepageHost || privacyHost}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- external third-party URLs, rendered only after hostOf() confirmed http(s) -->
				<div class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
					{#if homepageHost}
						<a
							href={application.homepage_url}
							target="_blank"
							rel="noopener noreferrer"
							class="text-primary underline-offset-4 hover:underline"
						>
							{m['oauth.consent.homepage']()}: {homepageHost}
						</a>
					{/if}
					{#if privacyHost}
						<a
							href={application.privacy_policy_url}
							target="_blank"
							rel="noopener noreferrer"
							class="text-primary underline-offset-4 hover:underline"
						>
							{m['oauth.consent.privacyPolicy']()}: {privacyHost}
						</a>
					{/if}
				</div>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
		</div>
	</div>

	{#if !application.verified}
		<Alert variant="warning">
			<ShieldAlert class="h-4 w-4" aria-hidden="true" />
			<AlertTitle>{m['oauth.consent.unverifiedTitle']()}</AlertTitle>
			<AlertDescription>{m['oauth.consent.unverifiedBody']()}</AlertDescription>
		</Alert>
	{/if}

	<div>
		{#if scopes.length > 0}
			<p class="mb-3 font-bold">{m['oauth.consent.asksTo']()}</p>
			<ScopeList {scopes} variant="grouped" />
		{:else}
			<p class="text-sm text-muted-foreground">{m['oauth.consent.noScopes']()}</p>
		{/if}
	</div>

	{#if redirectHost}
		<p class="text-sm text-muted-foreground">
			{m['oauth.consent.sentTo']({ host: redirectHost })}
		</p>
	{/if}
</div>
