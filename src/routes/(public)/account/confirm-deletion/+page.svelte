<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import type { ActionData } from './$types';
	import { AlertTriangle, Loader2, CheckCircle } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import ToneTile from '$lib/components/common/ToneTile.svelte';

	interface Props {
		form: ActionData;
	}

	const { form }: Props = $props();

	// Get token from URL query parameter
	const token = $derived($page.url.searchParams.get('token') || '');

	// State
	let isSubmitting = $state(false);

	// Success state
	const success = $derived(form?.success || false);

	// Error handling
	const errors = $derived((form?.errors || {}) as Record<string, string>);
</script>

<svelte:head>
	<title>{m['accountDeletion.title']()}</title>
	<meta name="description" content={m['accountDeletion.metaDescription']()} />
</svelte:head>

<!-- DELIBERATELY NOT on the uplift's celebration band (spec §9), unlike every
     other page in this cluster. Deleting your account is an irreversible,
     serious moment; a saturated poster panel would be the wrong register, and
     this page already documents that exception for its tiles and tints below.
     It takes the depth half of the uplift only: the 2px edge + poster float
     that the rest of the app's surfaces now carry, so the silhouette matches
     even though the colour language stays calm. -->
<div class="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
	<div class="w-full max-w-md space-y-8">
		{#if success}
			<!-- Success State: calm, not celebratory — no poster tint/Sticker even
			     though this is otherwise a Vol. 2 flow (danger-framing exception,
			     see confirm branch below). ToneTile is theme-token driven, not
			     poster imagery, so it stays in bounds here. -->
			<div class="text-center">
				<ToneTile icon={CheckCircle} tone="success" size="lg" class="mx-auto mb-4" />
				<h1 class="text-3xl font-black leading-[1.12] sm:text-4xl">
					{m['accountDeletion.successHeading']()}
				</h1>
				<p class="mt-2 text-muted-foreground">{m['accountDeletion.successSubheading']()}</p>
			</div>

			<!-- success/10 + border are decorative; title/body stay on foreground/
			     muted-foreground, both already-audited pairs. -->
			<div
				role="status"
				class="rounded-lg border-2 border-success/40 bg-success/10 p-6 shadow-poster dark:border-success/50 dark:bg-success/15"
			>
				<div class="space-y-2 text-sm">
					<p class="font-medium text-foreground">
						{m['accountDeletion.successMessage']()}
					</p>
					<p class="text-muted-foreground">
						{m['accountDeletion.successThankYou']()}
					</p>
				</div>
			</div>

			<!-- Call to Action -->
			<div class="text-center">
				<a
					href={resolve('/(public)', {})}
					class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					{m['accountDeletion.goToHomepage']()}
				</a>
			</div>
		{:else if !token}
			<!-- Missing Token Error: danger framing, no poster playfulness. -->
			<div class="text-center">
				<ToneTile icon={AlertTriangle} tone="danger" size="lg" class="mx-auto mb-4" />
				<h1 class="text-3xl font-black leading-[1.12] sm:text-4xl">
					{m['accountDeletion.invalidLinkHeading']()}
				</h1>
				<p class="mt-2 text-muted-foreground">
					{m['accountDeletion.invalidLinkSubheading']()}
				</p>
			</div>

			<div
				role="alert"
				class="rounded-lg border-2 border-destructive bg-destructive/10 p-4 shadow-poster"
			>
				<p class="text-sm font-medium text-destructive">
					{m['accountDeletion.invalidTokenError']()}
				</p>
				<p class="mt-2 text-sm text-muted-foreground">
					{m['accountDeletion.invalidTokenMessage']()}
				</p>
			</div>

			<div class="text-center">
				<a
					href={resolve('/(auth)/account/privacy', {})}
					class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					{m['accountDeletion.goToPrivacySettings']()}
				</a>
			</div>
		{:else}
			<!-- Confirmation Form: danger framing — destructive-token accents, no
			     poster playfulness, no Sticker. This is a serious, irreversible
			     moment, not a celebration one. -->
			<div class="text-center">
				<ToneTile icon={AlertTriangle} tone="danger" size="lg" class="mx-auto mb-4" />
				<h1 class="text-3xl font-black leading-[1.12] sm:text-4xl">
					{m['accountDeletion.confirmHeading']()}
				</h1>
				<p class="mt-2 text-muted-foreground">
					{m['accountDeletion.warningYouWillLose']()}
				</p>
			</div>

			<!-- Error Message -->
			{#if errors.form}
				<div role="alert" class="rounded-md border border-destructive bg-destructive/10 p-4">
					<p class="text-sm font-medium text-destructive">{errors.form}</p>
				</div>
			{/if}

			<!-- Warning Box -->
			<div class="rounded-lg border-2 border-destructive/40 bg-destructive/5 p-6 shadow-poster">
				<h2 class="font-bold text-destructive">{m['accountDeletion.confirmHeading']()}</h2>
				<div class="mt-4 space-y-2">
					<p class="text-sm font-medium">{m['accountDeletion.warningYouWillLose']()}</p>
					<ul class="space-y-1 text-sm text-muted-foreground">
						<li class="flex items-center gap-2">
							<span class="text-destructive">•</span>
							{m['accountDeletion.loss_events']()}
						</li>
						<li class="flex items-center gap-2">
							<span class="text-destructive">•</span>
							{m['accountDeletion.loss_history']()}
						</li>
						<li class="flex items-center gap-2">
							<span class="text-destructive">•</span>
							{m['accountDeletion.loss_memberships']()}
						</li>
						<li class="flex items-center gap-2">
							<span class="text-destructive">•</span>
							{m['accountDeletion.loss_profile']()}
						</li>
					</ul>
				</div>
			</div>

			<!-- Confirmation Form -->
			<form
				method="POST"
				action="?/confirmDeletion"
				use:enhance={() => {
					if (isSubmitting) return;
					isSubmitting = true;

					return async ({ update }) => {
						isSubmitting = false;
						await update();
					};
				}}
				class="space-y-4"
			>
				<input type="hidden" name="token" value={token} />

				<div class="flex gap-3">
					<a
						href={resolve('/(public)', {})}
						class="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					>
						{m['accountDeletion.cancel']()}
					</a>
					<button
						type="submit"
						disabled={isSubmitting}
						class="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isSubmitting}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
							<span>{m['accountDeletion.deleting']()}</span>
						{:else}
							<span>{m['accountDeletion.deleteButton']()}</span>
						{/if}
					</button>
				</div>
			</form>

			<p class="text-center text-xs text-muted-foreground">
				{m['accountDeletion.warningImmediate']()}
			</p>
		{/if}
	</div>
</div>
