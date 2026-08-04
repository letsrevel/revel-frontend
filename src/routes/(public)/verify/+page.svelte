<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';
	import { CheckCircle, XCircle } from '@lucide/svelte';
	import { SeoHead } from '$lib/seo';

	interface Props {
		data: PageData;
	}

	const { data }: Props = $props();
</script>

<SeoHead config={data.seo} />

<div class="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
	<div class="w-full max-w-md space-y-8 text-center">
		<!-- Hand-composed centerpiece (not the EmptyState primitive, which caps
		     at h2/h3): this page's only heading must be an h1. Chip recipe
		     mirrors EmptyState's internal poster-tinted chip. Failure has no
		     "danger" tone in the poster palette — "warning" (amber/ink, audited
		     pair) reads as the closest honest match for an expired/invalid link,
		     short of the full destructive framing reserved for confirm-deletion. -->
		<div>
			<span
				aria-hidden="true"
				class="mx-auto flex h-14 w-14 -rotate-2 items-center justify-center rounded-2xl shadow-sm {data.success
					? 'bg-success text-success-foreground'
					: 'bg-poster-amber text-poster-ink'}"
			>
				{#if data.success}
					<CheckCircle class="h-7 w-7" />
				{:else}
					<XCircle class="h-7 w-7" />
				{/if}
			</span>
			<h1 class="mt-4 text-3xl font-black leading-[1.12] sm:text-4xl">
				{data.success ? m['verifyPage.emailVerified']() : m['verifyPage.verificationFailed']()}
			</h1>
			<p class="mt-1.5 text-muted-foreground">
				{data.success
					? m['verifyPage.successRedirect']()
					: `${data.error || m['verifyPage.couldNotVerify']()} ${m['verifyPage.linkExpiredOrInvalid']()}`}
			</p>
		</div>

		<!-- Actions -->
		{#if !data.success}
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
		{/if}
	</div>
</div>
