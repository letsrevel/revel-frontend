<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		headline: string;
		/** The backend's `detail`, shown under the headline. */
		detail: string | null;
		/** Present only for retryable failures (network, 5xx); absent for 400s. */
		onRetry: (() => void) | null;
	}
	const { headline, detail, onRetry }: Props = $props();
</script>

<div class="space-y-4 rounded-2xl border border-border bg-card p-6 text-card-foreground">
	<h2 class="text-xl font-extrabold" tabindex="-1" data-testid="consent-error-headline">
		{headline}
	</h2>
	{#if detail}
		<p class="text-sm text-muted-foreground">{detail}</p>
	{/if}
	<div class="flex flex-wrap gap-2">
		{#if onRetry}
			<Button type="button" onclick={onRetry}>{m['oauth.consent.retry']()}</Button>
		{/if}
		<Button variant="outline" href={resolve('/(auth)/dashboard', {})}
			>{m['oauth.consent.backToRevel']()}</Button
		>
	</div>
</div>
