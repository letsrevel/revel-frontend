<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';
	import { CheckCircle, XCircle } from '@lucide/svelte';
	import { SeoHead } from '$lib/seo';
	import AuthBandLayout from '$lib/components/auth/AuthBandLayout.svelte';

	interface Props {
		data: PageData;
	}

	const { data }: Props = $props();
</script>

<SeoHead config={data.seo} />

<!-- Colour-block band + floating action card (uplift). The status chip moves
     INTO the band above the title — same recipe as before (EmptyState's
     poster-tinted tilted chip), still aria-hidden ornament. Failure has no
     "danger" tone in the poster palette; "warning" (amber/ink, audited pair)
     stays the closest honest match for an expired/invalid link, short of the
     full destructive framing reserved for confirm-deletion. The h1 and body
     copy are unchanged keys, now carried by the band. -->
{#snippet statusChip()}
	<span
		aria-hidden="true"
		class="flex h-16 w-16 -rotate-2 items-center justify-center rounded-2xl shadow-poster {data.success
			? 'bg-success text-success-foreground'
			: 'bg-poster-amber text-poster-ink'}"
	>
		{#if data.success}
			<CheckCircle class="h-8 w-8" />
		{:else}
			<XCircle class="h-8 w-8" />
		{/if}
	</span>
{/snippet}

<AuthBandLayout
	width="lg"
	chip={statusChip}
	title={data.success ? m['verifyPage.emailVerified']() : m['verifyPage.verificationFailed']()}
	subtitle={data.success
		? m['verifyPage.successRedirect']()
		: `${data.error || m['verifyPage.couldNotVerify']()} ${m['verifyPage.linkExpiredOrInvalid']()}`}
>
	{#if !data.success}
		<div class="rounded-lg border-2 border-border bg-card p-6 shadow-poster">
			<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
				<a
					href={resolve('/(public)/register', {})}
					class="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 sm:w-auto"
				>
					{m['verifyPage.createNewAccount']()}
				</a>
				<a
					href={resolve('/(public)/login', {})}
					class="inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-6 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 sm:w-auto"
				>
					{m['verifyPage.backToLogin']()}
				</a>
			</div>
		</div>
	{/if}
</AuthBandLayout>
