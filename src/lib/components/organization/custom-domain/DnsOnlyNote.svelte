<script lang="ts">
	import { Info } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { DnsProviderSchema } from '$lib/api/generated/types.gen';
	import { isCloudflare } from './custom-domain-api';

	interface Props {
		/** The detected DNS host, or null when it is unknown. */
		provider: DnsProviderSchema | null;
	}
	const { provider }: Props = $props();

	// Cloudflare proxies new records by default, and a proxied CNAME breaks
	// validation. Known Cloudflare: say it outright. Another known host: nothing
	// to warn about. Unknown host: the conditional line.
	const text = $derived(
		provider === null
			? m['customDomain.records.cloudflareNote']()
			: isCloudflare(provider)
				? m['customDomain.records.cloudflareKnown']()
				: null
	);
</script>

{#if text}
	<p
		class="flex items-start gap-2 rounded-md border border-info/40 bg-info/10 p-3 text-sm"
		data-testid="cname-cloudflare-warning"
	>
		<Info class="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
		<strong>{text}</strong>
	</p>
{/if}
