<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import { CheckCircle, XCircle, Loader2 } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import EmptyState from '$lib/components/common/EmptyState.svelte';

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

<!-- Both TERMINAL states are now the EmptyState display variant (level 1) rather
     than a hand-composed disc + h1 + body stack: same shape the primitive owns,
     and level 1 exists exactly so the page's only heading can stay an h1. The
     verifying branch below is deliberately left hand-composed — a spinner is not
     a terminal state and the primitive renders a static icon. -->
{#snippet settingsAction()}
	<a
		href={resolve('/(auth)/org/[slug]/admin/settings', { slug: data.organizationSlug ?? '' })}
		class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
	>
		{m['orgVerifyContactEmail.goToSettings']()}
	</a>
{/snippet}

{#snippet failureAction()}
	<div class="w-full space-y-3">
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
	</div>
{/snippet}

<div class="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
	<div class="w-full max-w-md">
		{#if data.isVerifying}
			<div class="space-y-8 text-center">
				<!-- Tinted status disc on a semantic token. Icon-vs-surface only (no
				     text sits on it), independently >= 3:1 in both modes — the same
				     tint ToneTile measures: info 8.3 light / 8.0 dark. -->
				<div class="flex justify-center">
					<div class="rounded-full bg-info/10 p-6">
						<Loader2 class="h-12 w-12 animate-spin text-info" aria-hidden="true" />
					</div>
				</div>
				<div class="space-y-2">
					<h1 class="text-3xl font-black leading-[1.12] sm:text-4xl">
						{m['orgVerifyContactEmail.verifying']()}
					</h1>
					<p class="text-muted-foreground">
						{m['orgVerifyContactEmail.verifyingDescription']()}
					</p>
				</div>
			</div>
		{:else if data.success}
			<EmptyState
				level={1}
				tone="success"
				icon={CheckCircle}
				title={m['orgVerifyContactEmail.success']()}
				body={m['orgVerifyContactEmail.successDescription']({
					organizationName: data.organizationName || 'Your organization'
				})}
				action={data.organizationSlug ? settingsAction : undefined}
			/>
		{:else}
			<!-- The poster palette has no "danger" hue and EmptyState's tone axis
			     excludes it; warning (amber/ink) is the same honest stand-in the auth
			     verify page settled on for an expired/invalid link, short of the full
			     destructive framing reserved for deletion. Mode-inert pair (imagery
			     rule), measured 9.42:1 — and the icon is aria-hidden ornament, so the
			     failure is never signalled by colour alone: the heading says it. -->
			<EmptyState
				level={1}
				tone="warning"
				icon={XCircle}
				title={m['orgVerifyContactEmail.failure']()}
				body={data.error || m['orgVerifyContactEmail.failureDescription']()}
				action={failureAction}
			/>
		{/if}
	</div>
</div>
