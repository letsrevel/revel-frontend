<script lang="ts">
	import { resolve } from '$app/paths';
	import type { TenantOrganizationSchema } from '$lib/api/generated/types.gen';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		tenant: TenantOrganizationSchema;
		/** Platform origin from PLATFORM_ORIGIN / PLATFORM_HOSTS; null renders plain text. */
		platformOrigin?: string | null;
	}

	const { tenant, platformOrigin = null }: Props = $props();

	const year = new Date().getFullYear();
	const linkClass =
		'inline-flex min-h-11 items-center rounded-sm underline-offset-4 transition-colors hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0';
</script>

<footer class="border-t bg-background">
	<div
		class="container mx-auto flex flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
	>
		<p>{m['tenantChrome.copyright']({ year, name: tenant.name })}</p>
		<div class="flex flex-wrap items-center gap-x-2">
			<span>{m['tenantChrome.poweredBy']()}</span>
			{#if platformOrigin}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- external link to the platform site -->
				<a href={platformOrigin} class="font-semibold {linkClass}">Revel</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{:else}
				<span class="font-semibold">Revel</span>
			{/if}
			<span aria-hidden="true">·</span>
			<nav aria-label={m['tenantChrome.legalNavigation']()} class="flex items-center gap-2">
				<a href={resolve('/(public)/legal/privacy', {})} class={linkClass}>
					{m['tenantChrome.privacy']()}
				</a>
				<span aria-hidden="true">·</span>
				<a href={resolve('/(public)/legal/terms', {})} class={linkClass}>
					{m['tenantChrome.terms']()}
				</a>
			</nav>
		</div>
	</div>
</footer>
