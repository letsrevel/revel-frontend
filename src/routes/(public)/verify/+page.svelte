<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';
	import { CheckCircle, XCircle } from '@lucide/svelte';
	import { SeoHead } from '$lib/seo';
	import EmptyState from '$lib/components/common/EmptyState.svelte';

	interface Props {
		data: PageData;
	}

	const { data }: Props = $props();
</script>

<SeoHead config={data.seo} />

<div class="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
	<div class="w-full max-w-md space-y-8 text-center">
		<!-- level=2: this EmptyState is the page's only heading. Failure has no
		     "danger" tone in EmptyState's palette (poster imagery only spans
		     brand/info/success/warning/neutral) — "warning" reads as the closest
		     honest match for an expired/invalid link, short of the full
		     destructive framing reserved for confirm-deletion. -->
		<EmptyState
			icon={data.success ? CheckCircle : XCircle}
			tone={data.success ? 'success' : 'warning'}
			title={data.success ? m['verifyPage.emailVerified']() : m['verifyPage.verificationFailed']()}
			body={data.success
				? m['verifyPage.successRedirect']()
				: `${data.error || m['verifyPage.couldNotVerify']()} ${m['verifyPage.linkExpiredOrInvalid']()}`}
			level={2}
			action={data.success ? undefined : failureActions}
		/>
	</div>
</div>

{#snippet failureActions()}
	<a
		href={resolve('/(public)/register', {})}
		class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
	>
		{m['verifyPage.createNewAccount']()}
	</a>
	<a
		href={resolve('/(public)/login', {})}
		class="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-6 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
	>
		{m['verifyPage.backToLogin']()}
	</a>
{/snippet}
