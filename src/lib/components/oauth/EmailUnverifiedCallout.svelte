<script lang="ts">
	import { resolve } from '$app/paths';
	import { MailWarning } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { Button } from '$lib/components/ui/button';
</script>

<EmptyState
	icon={MailWarning}
	tone="warning"
	level={2}
	title={m['oauth.developer.verifyEmailTitle']()}
	body={m['oauth.developer.verifyEmailBody']()}
>
	{#snippet action()}
		<Button href={resolve('/(auth)/account/profile', {})} variant="outline"
			>{m['oauth.developer.verifyEmailCta']()}</Button
		>
	{/snippet}
</EmptyState>
