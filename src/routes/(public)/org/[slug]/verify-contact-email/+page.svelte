<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import { CheckCircle, XCircle, Loader2 } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		data: PageData;
	}

	const { data }: Props = $props();
</script>

<svelte:head>
	<title>
		{data.success
			? m['orgVerifyContactEmail.successTitle']()
			: m['orgVerifyContactEmail.failureTitle']()} - Revel
	</title>
	<meta name="description" content={m['orgVerifyContactEmail.pageDescription']()} />
</svelte:head>

<div class="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
	<div class="w-full max-w-md space-y-8 text-center">
		<!-- Icon -->
		<div class="flex justify-center">
			{#if data.isVerifying}
				<!-- Tinted status discs on semantic tokens. Icon-vs-surface only (no
				     text sits on these), independently >= 3:1 in both modes — the same
				     tints ToneTile measures: info 8.3 light / 8.0 dark, success 4.4 /
				     8.7. -->
				<div class="rounded-full bg-info/10 p-6">
					<Loader2 class="h-12 w-12 animate-spin text-info" aria-hidden="true" />
				</div>
			{:else if data.success}
				<div class="rounded-full bg-success/10 p-6">
					<CheckCircle class="h-12 w-12 text-success" aria-hidden="true" />
				</div>
			{:else}
				<div class="rounded-full bg-destructive/10 p-6">
					<XCircle class="h-12 w-12 text-destructive" aria-hidden="true" />
				</div>
			{/if}
		</div>

		<!-- Message -->
		<div class="space-y-2">
			{#if data.isVerifying}
				<h1 class="text-3xl font-black leading-[1.12] sm:text-4xl">
					{m['orgVerifyContactEmail.verifying']()}
				</h1>
				<p class="text-muted-foreground">
					{m['orgVerifyContactEmail.verifyingDescription']()}
				</p>
			{:else if data.success}
				<h1 class="text-3xl font-black leading-[1.12] sm:text-4xl">
					{m['orgVerifyContactEmail.success']()}
				</h1>
				<p class="text-muted-foreground">
					{m['orgVerifyContactEmail.successDescription']({
						organizationName: data.organizationName || 'Your organization'
					})}
				</p>
			{:else}
				<h1 class="text-3xl font-black leading-[1.12] sm:text-4xl">
					{m['orgVerifyContactEmail.failure']()}
				</h1>
				<p class="text-muted-foreground">
					{data.error || m['orgVerifyContactEmail.failureDescription']()}
				</p>
			{/if}
		</div>

		<!-- Actions -->
		{#if !data.isVerifying}
			<div class="space-y-3 border-t pt-6">
				{#if data.success && data.organizationSlug}
					<a
						href={resolve('/(auth)/org/[slug]/admin/settings', { slug: data.organizationSlug })}
						class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					>
						{m['orgVerifyContactEmail.goToSettings']()}
					</a>
				{:else if !data.success}
					<p class="text-sm text-muted-foreground">
						{m['orgVerifyContactEmail.linkExpired']()}
					</p>
					<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
						<a
							href={resolve('/(auth)/dashboard', {})}
							class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						>
							{m['orgVerifyContactEmail.goToDashboard']()}
						</a>
						<a
							href={resolve('/(public)/login', {})}
							class="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-6 py-2 text-sm font-bold transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						>
							{m['orgVerifyContactEmail.backToLogin']()}
						</a>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
