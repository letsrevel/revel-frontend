<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';
	import type { ClaimResult } from './+page.server';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import Sticker from '$lib/components/brand/Sticker.svelte';
	import { loginHref, withReturnUrl } from '$lib/utils/safe-redirect';
	import {
		CircleCheck,
		CircleAlert,
		Loader2,
		MailX,
		Hourglass,
		TriangleAlert
	} from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		data: PageData;
		form?: ActionData;
	}
	const { data, form }: Props = $props();

	const preview = $derived(data.preview);
	const claim = $derived<ClaimResult | undefined>(form?.claim);

	/** Where login / register / sign-out send the visitor back to. */
	const invitePath = $derived(`/member-invite/${encodeURIComponent(data.token)}`);
	const logInHref = $derived(loginHref(invitePath));
	// Registration carries the target through email verification (BE #1023).

	const registerHref = $derived(withReturnUrl(resolve('/(public)/register', {}), invitePath));

	const signOutHref = $derived(withReturnUrl(resolve('/(public)/logout', {}), invitePath));
	const retryHref = $derived(resolve('/(public)/member-invite/[token]', { token: data.token }));

	// `locals.user` is decoded from the access token, which carries no email
	// claim, so the address only exists once the auth store has hydrated.
	const email = $derived(authStore.user?.email ?? null);

	let isSubmitting = $state(false);
	let resultHeading = $state<HTMLHeadingElement | null>(null);

	// The result replaces (or sits above) the confirm button, so without this
	// focus is stranded on a control that is gone (WCAG 2.4.3 / 4.1.3).
	$effect(() => {
		if (claim) resultHeading?.focus();
	});

	/**
	 * Outcomes with nothing left to confirm: the form is replaced by the result.
	 * Throttled / error stay retryable, so the confirm form remains under them.
	 */
	const terminal = $derived(
		claim?.outcome === 'conflict' ||
			claim?.outcome === 'forbidden' ||
			claim?.outcome === 'not_found'
	);

	// A claimed token is consumed, so on success the preview (re-run by load
	// after a no-JS POST) is a 404: the success view reads only the claim result.
	const successOrgName = $derived(
		claim?.outcome === 'success' ? (claim.organizationName ?? claim.organizationSlug) : ''
	);

	const resultCopy = $derived.by((): { title: string; body: string } | null => {
		if (!claim) return null;
		switch (claim.outcome) {
			case 'success':
				return {
					title: m['memberInvite.successTitle'](),
					body: m['memberInvite.successBody']({ organization: successOrgName })
				};
			case 'unauthenticated':
				return {
					title: m['memberInvite.sessionExpiredTitle'](),
					body: m['memberInvite.sessionExpiredBody']()
				};
			case 'conflict':
				return {
					title: m['memberInvite.conflictTitle'](),
					// The backend's own (server-translated) sentence tells the two 409s apart.
					body: claim.detail || m['memberInvite.conflictBody']()
				};
			case 'forbidden':
				return {
					title: m['memberInvite.forbiddenTitle'](),
					body: m['memberInvite.forbiddenBody']()
				};
			case 'not_found':
				return {
					title: m['memberInvite.notFoundTitle'](),
					body: m['memberInvite.notFoundBody']()
				};
			case 'throttled':
				return {
					title: m['memberInvite.throttledTitle'](),
					body: m['memberInvite.throttledBody']()
				};
			default:
				return { title: m['memberInvite.errorTitle'](), body: m['memberInvite.errorBody']() };
		}
	});
</script>

{#snippet resultBlock(c: ClaimResult, copy: { title: string; body: string })}
	<!--
		Focus moves to the heading, so there is deliberately no role=status/alert
		here: a live region plus a focus move would announce the result twice.
	-->
	<div class="flex items-start gap-3" data-testid="member-invite-result">
		{#if c.outcome === 'success'}
			<CircleCheck class="mt-1 h-6 w-6 shrink-0 text-success" aria-hidden="true" />
		{:else}
			<CircleAlert class="mt-1 h-6 w-6 shrink-0 text-destructive" aria-hidden="true" />
		{/if}
		<div class="space-y-2">
			<h2 bind:this={resultHeading} tabindex="-1" class="text-xl font-extrabold outline-none">
				{copy.title}
			</h2>
			<p class="text-sm text-muted-foreground sm:text-base">{copy.body}</p>
		</div>
	</div>
{/snippet}

<svelte:head>
	<title>{m['memberInvite.title']()}</title>
	<!-- Invitation tokens must never be indexed or leak through Referer. -->
	<meta name="robots" content="noindex,nofollow" />
	<meta name="referrer" content="no-referrer" />
</svelte:head>

<div class="container mx-auto max-w-2xl px-4 py-10 sm:py-14">
	{#if claim?.outcome === 'success' && resultCopy}
		<PageHeader
			volume="celebration"
			kicker={m['memberInvite.kicker']()}
			title={m['memberInvite.title']()}
		/>
		<Card class="mt-8">
			<CardContent class="space-y-6 p-6 sm:p-8">
				{@render resultBlock(claim, resultCopy)}
				<div class="flex flex-col gap-2 sm:flex-row">
					<Button href={resolve('/(public)/org/[slug]', { slug: claim.organizationSlug })}>
						{m['memberInvite.goToOrg']({ organization: successOrgName })}
					</Button>
					<Button href={resolve('/(auth)/account/memberships', {})} variant="outline">
						{m['memberInvite.myMemberships']()}
					</Button>
				</div>
			</CardContent>
		</Card>
	{:else if preview.status === 'not_found'}
		<EmptyState
			level={1}
			icon={MailX}
			tone="neutral"
			title={m['memberInvite.notFoundTitle']()}
			body={m['memberInvite.notFoundBody']()}
		>
			{#snippet action()}
				<Button href={resolve('/', {})}>{m['memberInvite.goHome']()}</Button>
			{/snippet}
		</EmptyState>
	{:else if preview.status === 'throttled'}
		<EmptyState
			level={1}
			icon={Hourglass}
			tone="warning"
			title={m['memberInvite.throttledTitle']()}
			body={m['memberInvite.throttledBody']()}
		>
			{#snippet action()}
				<Button href={retryHref} data-sveltekit-reload>{m['memberInvite.retry']()}</Button>
			{/snippet}
		</EmptyState>
	{:else if preview.status === 'error'}
		<EmptyState
			level={1}
			icon={TriangleAlert}
			tone="warning"
			title={m['memberInvite.errorTitle']()}
			body={m['memberInvite.errorBody']()}
		>
			{#snippet action()}
				<Button href={retryHref} data-sveltekit-reload>{m['memberInvite.retry']()}</Button>
				<Button href={resolve('/', {})} variant="outline">{m['memberInvite.goHome']()}</Button>
			{/snippet}
		</EmptyState>
	{:else if preview.status === 'ok'}
		<PageHeader
			volume="celebration"
			kicker={m['memberInvite.kicker']()}
			title={m['memberInvite.title']()}
			subtitle={m['memberInvite.subtitle']({
				organization: preview.organizationName,
				name: preview.fullName
			})}
		>
			{#snippet decoration()}
				<Sticker tint="purple" rotate={-3} class="text-sm">
					<CircleCheck class="mb-0.5 inline h-4 w-4" />
				</Sticker>
			{/snippet}
		</PageHeader>

		<Card class="mt-8">
			<CardContent class="space-y-6 p-6 sm:p-8">
				<dl class="space-y-1">
					<dt class="text-sm font-medium text-muted-foreground">
						{m['memberInvite.entryLabel']()}
					</dt>
					<dd class="break-words text-xl font-extrabold" data-testid="member-invite-entry">
						{preview.fullName}
					</dd>
					<dd class="text-sm text-muted-foreground">{preview.organizationName}</dd>
				</dl>

				{#if claim && resultCopy}
					{@render resultBlock(claim, resultCopy)}
				{/if}

				{#if claim?.outcome === 'unauthenticated'}
					<Button href={logInHref}>{m['memberInvite.login']()}</Button>
				{:else if terminal}
					<Button href={resolve('/', {})} variant="outline" class="w-full sm:w-auto">
						{m['memberInvite.goHome']()}
					</Button>
				{:else if data.signedIn}
					<div class="space-y-4">
						<p class="text-sm sm:text-base">
							{email
								? m['memberInvite.signedInAs']({ email })
								: m['memberInvite.signedInNoEmail']()}
						</p>
						<p class="text-sm text-muted-foreground">{m['memberInvite.confirmNote']()}</p>
						<form
							method="POST"
							class="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center"
							use:enhance={({ cancel }) => {
								if (isSubmitting) return cancel();
								isSubmitting = true;
								return async ({ update }) => {
									try {
										// invalidateAll:false: the anonymous preview must not re-run
										// (throttle) and a consumed token would 404 it anyway.
										await update({ reset: false, invalidateAll: false });
									} finally {
										isSubmitting = false;
									}
								};
							}}
						>
							<Button type="submit" disabled={isSubmitting} class="gap-2">
								{#if isSubmitting}
									<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
									{m['memberInvite.linking']()}
								{:else}
									{m['memberInvite.link']()}
								{/if}
							</Button>
							<!-- eslint-disable svelte/no-navigation-without-resolve -- signOutHref is resolve() output plus a ?returnUrl= query -->
							<a
								href={signOutHref}
								class="text-center text-sm text-primary underline underline-offset-4 sm:text-left"
							>
								{m['memberInvite.signOut']()}
							</a>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						</form>
					</div>
				{:else}
					<div class="space-y-4">
						<p class="text-sm text-muted-foreground sm:text-base">
							{m['memberInvite.signedOutHint']()}
						</p>
						<div class="flex flex-col gap-2 sm:flex-row">
							<!-- eslint-disable svelte/no-navigation-without-resolve -- hrefs are built by loginHref()/withReturnUrl(), which wrap resolve() -->
							<Button href={logInHref}>{m['memberInvite.login']()}</Button>
							<Button href={registerHref} variant="outline">{m['memberInvite.register']()}</Button>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						</div>
					</div>
				{/if}
			</CardContent>
		</Card>
	{/if}
</div>
