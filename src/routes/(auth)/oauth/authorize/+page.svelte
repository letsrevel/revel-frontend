<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { Loader2 } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type {
		AuthorizeDecisionPayload,
		AuthorizeDescribeResponse
	} from '$lib/api/generated/types.gen';
	import {
		decideAuthorization,
		describeAuthorization,
		type AuthorizeResult
	} from '$lib/api/queries/oauth-authorize';
	import { isConsentExpired, oauthErrorHeadline } from '$lib/utils/oauth-errors';
	import { navigateTo } from '$lib/utils/navigate-to';
	import { authStore } from '$lib/stores/auth.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import ConsentAppCard from '$lib/components/oauth/ConsentAppCard.svelte';
	import ConsentError from '$lib/components/oauth/ConsentError.svelte';
	import { Button } from '$lib/components/ui/button';

	type Status = 'loading' | 'consent' | 'submitting' | 'redirecting' | 'error';

	// The client's authorization request, byte-for-byte. Captured ONCE: both
	// the describe GET and the decision POST must carry the identical string,
	// or the consent-ticket fingerprint no longer matches (spec: PR 1).
	let search = $state('');
	let status = $state<Status>('loading');
	let consent = $state<AuthorizeDescribeResponse | null>(null);
	let expiredNotice = $state(false);
	let redirectHost = $state('');
	let error = $state<{
		headline: string;
		detail: string | null;
		retry: (() => void) | null;
	} | null>(null);

	const user = $derived(authStore.user);
	const currentPath = $derived(`/oauth/authorize${search}`);
	const switchAccountHref = $derived(
		`${resolve('/(public)/logout', {})}?returnUrl=${encodeURIComponent(currentPath)}`
	);
	const titleId = 'oauth-consent-title';

	function hostOf(url: string): string {
		try {
			return new URL(url).host;
		} catch {
			return '';
		}
	}

	async function focusTitle() {
		await tick();
		document.getElementById(titleId)?.focus();
	}

	async function focusError() {
		await tick();
		document.querySelector<HTMLElement>('[data-testid="consent-error-headline"]')?.focus();
	}

	function follow(redirectTo: string) {
		redirectHost = hostOf(redirectTo);
		status = 'redirecting';
		navigateTo(redirectTo);
	}

	function toLogin() {
		navigateTo(`/login?returnUrl=${encodeURIComponent(currentPath)}`);
	}

	/** Shared handling of every non-describe outcome; `retry` is offered only for retryable failures. */
	function fail(result: Exclude<AuthorizeResult, { kind: 'describe' }>, retry: () => void) {
		if (result.kind === 'redirect') return follow(result.redirectTo);
		if (result.kind === 'unauthenticated') return toLogin();
		if (result.kind === 'error') {
			error = {
				headline: oauthErrorHeadline(result.code),
				detail: result.detail || null,
				retry: null
			};
		} else {
			error = { headline: m['oauth.consent.errorFallbackHeadline'](), detail: null, retry };
		}
		status = 'error';
		void focusError();
	}

	async function describe() {
		status = 'loading';
		error = null;
		const result = await describeAuthorization(search);
		if (result.kind === 'describe') {
			consent = result.data;
			status = 'consent';
			void focusTitle();
			return;
		}
		fail(result, () => void describe());
	}

	async function decide(body: AuthorizeDecisionPayload) {
		status = 'submitting';
		const result = await decideAuthorization(search, body);
		if (result.kind === 'error' && isConsentExpired(result.code)) {
			// The 5-minute ticket lapsed: fetch a fresh screen and say so, without
			// moving focus or adding another live region (the warning alert is
			// the only role="alert" on this page).
			const fresh = await describeAuthorization(search);
			if (fresh.kind === 'describe') {
				consent = fresh.data;
				expiredNotice = true;
				status = 'consent';
				return;
			}
			return fail(fresh, () => void describe());
		}
		if (result.kind === 'redirect') return follow(result.redirectTo);
		fail(result, () => void decide(body));
	}

	// While a decision is in flight the buttons are aria-disabled, not
	// natively disabled (that would blur the focused button to <body>), so
	// the handlers themselves must refuse a second submission.
	function allow() {
		if (!consent || status === 'submitting') return;
		expiredNotice = false;
		void decide({ allow: true, consent_ticket: consent.consent_ticket });
	}

	function deny() {
		if (status === 'submitting') return;
		expiredNotice = false;
		void decide({ allow: false });
	}

	onMount(() => {
		search = window.location.search;
		void describe();
	});

	// The page's ONE polite live region: it exists from first render (outside
	// the status chain) so every state change below is actually announced.
	const liveMessage = $derived.by(() => {
		if (status === 'loading') return m['oauth.consent.checking']();
		if (status === 'submitting') return m['oauth.consent.sending']();
		if (status === 'redirecting') return m['oauth.consent.redirecting']({ host: redirectHost });
		if (status === 'consent' && expiredNotice) return m['oauth.consent.expiredNotice']();
		return '';
	});

	const pageTitle = $derived(
		consent
			? m['oauth.consent.title']({ name: consent.application.name }).slice(0, 60)
			: m['oauth.consent.kicker']()
	);
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<div class="container mx-auto max-w-lg space-y-6 px-4 py-8">
	<p class="sr-only" aria-live="polite" data-testid="consent-live-region">{liveMessage}</p>

	{#if status === 'loading'}
		<p class="flex items-center gap-2 text-muted-foreground" aria-hidden="true">
			<Loader2 class="h-4 w-4 animate-spin" />
			{m['oauth.consent.checking']()}
		</p>
	{:else if status === 'redirecting'}
		<p class="text-muted-foreground" aria-hidden="true">
			{m['oauth.consent.redirecting']({ host: redirectHost })}
		</p>
	{:else if status === 'error' && error}
		<PageHeader volume="celebration" title={m['oauth.consent.kicker']()} />
		<ConsentError headline={error.headline} detail={error.detail} onRetry={error.retry} />
	{:else if consent}
		<PageHeader
			volume="celebration"
			kicker={m['oauth.consent.kicker']()}
			title={m['oauth.consent.title']({ name: consent.application.name })}
			titleAttrs={{ id: titleId, tabindex: -1 }}
			class="[&_h1]:break-words"
		/>

		<ConsentAppCard
			application={consent.application}
			scopes={consent.scopes}
			redirectUri={consent.redirect_uri}
		/>

		{#if user}
			<p class="text-sm text-muted-foreground">
				{m['oauth.consent.signedInAs']({ name: user.display_name, email: user.email })}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- the path comes from resolve() in switchAccountHref; the appended returnUrl query cannot be expressed through resolve() -->
				<a
					href={switchAccountHref}
					data-sveltekit-reload
					class="ml-1 text-primary underline underline-offset-4"
				>
					{m['oauth.consent.switchAccount']()}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</p>
		{/if}

		{#if expiredNotice}
			<!-- Visual copy only; the live region above carries it to AT. -->
			<p class="text-sm text-muted-foreground" aria-hidden="true">
				{m['oauth.consent.expiredNotice']()}
			</p>
		{/if}

		<div class="flex flex-col gap-2 sm:flex-row">
			<Button
				type="button"
				onclick={allow}
				aria-disabled={status === 'submitting' ? 'true' : undefined}
				class="aria-disabled:pointer-events-none aria-disabled:opacity-50 sm:flex-1"
			>
				{m['oauth.consent.allow']()}
			</Button>
			<Button
				type="button"
				variant="outline"
				onclick={deny}
				aria-disabled={status === 'submitting' ? 'true' : undefined}
				class="aria-disabled:pointer-events-none aria-disabled:opacity-50 sm:flex-1"
			>
				{m['oauth.consent.deny']()}
			</Button>
		</div>
	{/if}
</div>
