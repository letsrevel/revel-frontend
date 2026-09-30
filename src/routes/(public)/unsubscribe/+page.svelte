<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';
	import { NotificationPreferencesForm } from '$lib/components/notifications';
	import type { NotificationPreferenceSchema } from '$lib/api/generated/types.gen';
	import { oneclickunsubscribeOneClick } from '$lib/api';
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Bell, MailX, ShieldCheck, Loader2 } from '@lucide/svelte';
	import { SeoHead } from '$lib/seo';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ToneTile from '$lib/components/common/ToneTile.svelte';
	import { Button } from '$lib/components/ui/button';

	const { data }: { data: PageData } = $props();

	// Default for the unsubscribe form (#982): stop ordinary email, keep in-app.
	// Silence stays OFF and no per-type settings are sent. Tickets, receipts,
	// payment/refund and legal/platform notices can't be opted out of anyway
	// (BE #1030), so "silence everything" only ever hid useful in-app notices.
	const defaultPreferences: NotificationPreferenceSchema = {
		silence_all_notifications: false,
		event_reminders_enabled: true,
		enabled_channels: ['in_app'],
		digest_frequency: 'immediate',
		digest_send_time: '09:00',
		notification_type_settings: {},
		muted_organization_ids: []
	};

	// Statuses the one-click endpoint uses for a link it won't honour.
	const INVALID_TOKEN_STATUSES = new Set([400, 401, 404]);

	type Outcome = 'preferences' | 'stopped' | 'optedOut';

	// Both results are keyed by the token they belong to, so a client-side
	// navigation to another ?token= starts clean instead of inheriting them.
	let finished = $state<{ token: string | null; outcome: Outcome } | null>(null);
	// The backend rejected a token that decoded fine (revoked, email changed,
	// expired between load and submit).
	let rejectedToken = $state<string | null>(null);
	let oneClickPending = $state(false);
	let invalidHeading = $state<HTMLHeadingElement | null>(null);
	let successRegion = $state<HTMLDivElement | null>(null);

	const outcome = $derived(finished?.token === data.token ? finished.outcome : null);
	const rejected = $derived(rejectedToken !== null && rejectedToken === data.token);
	const tokenInfo = $derived(data.tokenInfo);
	const validToken = $derived(tokenInfo.status === 'valid' && !rejected ? tokenInfo : null);
	const isOrgAnnouncement = $derived(
		validToken?.kind === 'unsubscribe' &&
			validToken.notificationType === 'org_announcement' &&
			!!validToken.organizationId
	);
	const settingsReturnUrl = encodeURIComponent(resolve('/(auth)/account/settings', {}));

	// The clicked control disappears with the swap, so move focus to the
	// confirmation. No auto-redirect: a timed navigation cut screen-reader users
	// off mid-message (WCAG 2.2.1); the "Go home" link is on request instead.
	async function finish(result: Outcome) {
		finished = { token: data.token, outcome: result };
		await tick();
		// Focus the confirmation's h1 (EmptyState owns it, so no ref prop) so
		// screen readers announce a real heading, not an unnamed container.
		const heading = successRegion?.querySelector<HTMLElement>('h1');
		heading?.setAttribute('tabindex', '-1');
		heading?.classList.add('focus:outline-none');
		heading?.focus();
	}

	async function showRejected() {
		rejectedToken = data.token;
		await tick();
		// The page swapped under the user's click; move focus to the explanation.
		invalidHeading?.focus();
	}

	async function oneClick(result: Outcome) {
		if (!data.token || oneClickPending) return;
		oneClickPending = true;
		try {
			// No auth, no body: the endpoint reads only the query token and ignores
			// the RFC 8058 form body.
			const res = await oneclickunsubscribeOneClick({ query: { token: data.token } });
			if (res.error) {
				if (INVALID_TOKEN_STATUSES.has(res.response?.status ?? 0)) {
					await showRejected();
				} else {
					toast.error(m['unsubscribePage.oneClickFailed']());
				}
				return;
			}
			await finish(result);
		} catch {
			toast.error(m['unsubscribePage.oneClickFailed']());
		} finally {
			oneClickPending = false;
		}
	}
</script>

<SeoHead config={data.seo} />

<div class="container mx-auto max-w-2xl px-4 py-8">
	<!-- Always mounted so the change is announced. The one-click buttons stay
	     focusable while pending (aria-disabled, guarded in oneClick) instead of
	     `disabled`, which would drop keyboard focus mid-request. -->
	<p class="sr-only" role="status">
		{oneClickPending ? m['unsubscribePage.processing']() : ''}
	</p>
	{#if outcome}
		<!-- Success message: the EmptyState DISPLAY variant (level 1), whose
		     only heading is the page h1. -->
		<div bind:this={successRegion}>
			<EmptyState
				level={1}
				tone="success"
				icon={Bell}
				title={m['unsubscribePage.successTitle']()}
				body={outcome === 'optedOut' && tokenInfo.status === 'valid'
					? m['unsubscribePage.optOutSuccessDescription']({ email: tokenInfo.email })
					: outcome === 'stopped'
						? m['unsubscribePage.quickStopSuccessDescription']()
						: m['unsubscribePage.successDescription']()}
			>
				{#snippet action()}
					<Button href={resolve('/(public)', {})} variant="outline">
						{m['unsubscribePage.goHome']()}
					</Button>
				{/snippet}
			</EmptyState>
		</div>
	{:else if !validToken}
		<!-- Missing, malformed, expired, or rejected by the backend -->
		<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
			<h1
				bind:this={invalidHeading}
				tabindex="-1"
				class="text-3xl font-black leading-[1.12] text-destructive focus:outline-none sm:text-4xl"
			>
				{m['unsubscribePage.invalidTokenTitle']()}
			</h1>
			<p class="mt-2 text-muted-foreground">
				{m['unsubscribePage.invalidTokenDescription']()}
			</p>
			<div class="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
				<Button
					href={`${resolve('/(public)/login', {})}?returnUrl=${settingsReturnUrl}`}
					class="w-full sm:w-auto"
				>
					{m['unsubscribePage.loginToManage']()}
				</Button>
				<Button href={resolve('/(public)', {})} variant="outline" class="w-full sm:w-auto">
					{m['unsubscribePage.goHome']()}
				</Button>
			</div>
		</div>
	{:else if validToken.kind === 'email_opt_out'}
		<!-- Invitation opt-out for an address without a Revel account -->
		<PageHeader
			title={m['unsubscribePage.optOutTitle']()}
			subtitle={m['unsubscribePage.optOutDescription']({ email: validToken.email })}
			volume="celebration"
			class="mb-8"
		/>
		<div class="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
			<Button
				type="button"
				onclick={() => oneClick('optedOut')}
				aria-disabled={oneClickPending}
				class="w-full aria-disabled:pointer-events-none aria-disabled:opacity-50 sm:w-auto"
			>
				{#if oneClickPending}
					<Loader2 class="animate-spin" aria-hidden="true" />
				{/if}
				{m['unsubscribePage.optOutButton']()}
			</Button>
		</div>
	{:else}
		<!-- Unsubscribe form -->
		<PageHeader
			title={m['unsubscribePage.title']()}
			subtitle={m['unsubscribePage.subtitle']()}
			volume="celebration"
			class="mb-6"
		/>

		<div class="mb-6 flex items-start gap-3 rounded-lg border bg-card p-4 text-card-foreground">
			<ToneTile icon={ShieldCheck} tone="info" size="sm" />
			<div class="space-y-1">
				<h2 class="font-bold">
					{m['unsubscribePage.mandatoryNoticeTitle']()}
				</h2>
				<p class="text-sm text-muted-foreground">
					{m['unsubscribePage.mandatoryNotice']()}
				</p>
			</div>
		</div>

		{#if validToken.notificationType}
			<!-- Scoped shortcut: stop only the kind of email this link came from -->
			<section
				class="mb-6 rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
				aria-labelledby="unsubscribe-quick-stop-title"
			>
				<div class="flex items-start gap-3">
					<ToneTile icon={MailX} tone="brand" size="sm" />
					<div class="flex-1 space-y-1">
						<h2 id="unsubscribe-quick-stop-title" class="font-bold">
							{m['unsubscribePage.quickStopTitle']()}
						</h2>
						<p class="text-sm text-muted-foreground">
							{isOrgAnnouncement
								? m['unsubscribePage.quickStopOrgDescription']()
								: m['unsubscribePage.quickStopDescription']()}
						</p>
					</div>
				</div>
				<div class="mt-4 flex sm:justify-end">
					<Button
						type="button"
						onclick={() => oneClick('stopped')}
						aria-disabled={oneClickPending}
						class="w-full aria-disabled:pointer-events-none aria-disabled:opacity-50 sm:w-auto"
					>
						{#if oneClickPending}
							<Loader2 class="animate-spin" aria-hidden="true" />
						{/if}
						{isOrgAnnouncement
							? m['unsubscribePage.quickStopOrgButton']()
							: m['unsubscribePage.quickStopButton']()}
					</Button>
				</div>
			</section>

			<h2 class="mb-4 text-xl font-extrabold">{m['unsubscribePage.customizeHeading']()}</h2>
		{/if}

		<div class="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
			<NotificationPreferencesForm
				preferences={defaultPreferences}
				unsubscribeToken={data.token ?? undefined}
				onSave={() => void finish('preferences')}
				onInvalidToken={showRejected}
			/>
		</div>
	{/if}
</div>
