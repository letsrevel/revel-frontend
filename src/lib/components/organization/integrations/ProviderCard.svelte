<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import {
		AlertCircle,
		AlertTriangle,
		Check,
		ExternalLink,
		Loader2,
		Plug,
		Unplug
	} from '@lucide/svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { Tone } from '$lib/components/common/tones';
	import type { ConnectionSchema } from '$lib/api/generated/types.gen';
	import {
		organizationintegrationsConnect,
		organizationintegrationsDisconnect,
		organizationintegrationsUpdate
	} from '$lib/api/generated/sdk.gen';
	import { formatDate } from '$lib/utils/date';
	import {
		integrationErrorFromResponse,
		isIntegrationErrorInfo,
		silentIntegrationError,
		type IntegrationErrorInfo
	} from '$lib/utils/integration-errors';
	import { connectionView } from './connection-view';
	import AccountPicker from './AccountPicker.svelte';

	interface Props {
		organizationSlug: string;
		connection: ConnectionSchema;
		/** The page re-fetches the list (invalidateAll) after any change. */
		onChanged: () => void;
	}
	const { organizationSlug, connection, onChanged }: Props = $props();

	const platform = $derived(connection.display_name);
	const view = $derived(connectionView(connection));
	const headingId = $derived(`integration-${connection.provider}`);

	let actionError = $state<IntegrationErrorInfo | null>(null);
	let showDisconnect = $state(false);
	// Optimistic mirror of the checkbox; the server value wins whenever the
	// list is re-fetched, and a failed PATCH snaps it back.
	let autoSync = $state(false);
	$effect(() => {
		autoSync = connection.auto_sync ?? false;
	});

	function toInfo(err: unknown): IntegrationErrorInfo {
		return isIntegrationErrorInfo(err) ? err : integrationErrorFromResponse(err, platform);
	}

	// The connect response also sets the OAuth state cookie. The generated client
	// sends credentials on every call (src/lib/api/client.ts), so nothing to add
	// here; the cookie lives ten minutes, so navigate at once.
	const connect = createMutation(() => ({
		mutationFn: async () => {
			const res = await organizationintegrationsConnect({
				path: { slug: organizationSlug, provider: connection.provider }
			});
			if (res.error || !res.data) throw silentIntegrationError(res.error, platform);
			return res.data;
		},
		onSuccess: (data) => {
			window.location.assign(data.authorize_url);
		},
		onError: (err: unknown) => {
			actionError = toInfo(err);
		}
	}));

	const update = createMutation(() => ({
		mutationFn: async (auto_sync: boolean) => {
			const res = await organizationintegrationsUpdate({
				path: { slug: organizationSlug, provider: connection.provider },
				body: { auto_sync }
			});
			if (res.error || !res.data) throw silentIntegrationError(res.error, platform);
			return res.data;
		},
		onSuccess: () => onChanged(),
		onError: (err: unknown) => {
			actionError = toInfo(err);
			autoSync = connection.auto_sync ?? false;
		}
	}));

	const disconnect = createMutation(() => ({
		mutationFn: async () => {
			const res = await organizationintegrationsDisconnect({
				path: { slug: organizationSlug, provider: connection.provider }
			});
			if (res.error) throw silentIntegrationError(res.error, platform);
			return true;
		},
		onSuccess: () => {
			showDisconnect = false;
			onChanged();
		},
		onError: (err: unknown) => {
			showDisconnect = false;
			actionError = toInfo(err);
		}
	}));

	function onAutoSyncChange(event: Event) {
		const checked = (event.currentTarget as HTMLInputElement).checked;
		autoSync = checked;
		actionError = null;
		update.mutate(checked);
	}

	function startConnect() {
		actionError = null;
		connect.mutate();
	}

	// Soft tint on the status card, background and border only. Tone lives in
	// the icon chip and this tint, never in body text (StripeConnect precedent).
	const CARD_TONE_CLASSES: Record<Tone, string> = {
		brand: 'border-primary/40 bg-primary/10',
		info: 'border-info/40 bg-info/10',
		success: 'border-success/40 bg-success/10',
		warning: 'border-highlight/40 bg-highlight/20',
		danger: 'border-destructive/40 bg-destructive/10',
		neutral: 'border-border bg-muted'
	};
	// Solid icon-chip fill; every pair is an audited *-foreground/* token pair.
	const ICON_CHIP_CLASSES: Record<Tone, string> = {
		brand: 'bg-primary text-primary-foreground',
		info: 'bg-info text-info-foreground',
		success: 'bg-success text-success-foreground',
		warning: 'bg-highlight text-highlight-foreground',
		danger: 'bg-destructive text-destructive-foreground',
		neutral: 'bg-muted text-muted-foreground'
	};

	const title = $derived.by(() => {
		switch (view.kind) {
			case 'active':
				return m['integrations.card.connectedAs']({
					account: connection.remote_account_name || platform
				});
			case 'pending':
				return m['integrations.card.pending.title']();
			case 'access-lost':
				return m['integrations.card.accessLost.title']();
			default:
				return platform;
		}
	});

	const body = $derived.by(() => {
		switch (view.kind) {
			case 'active':
				return connection.connected_at
					? m['integrations.card.connectedSince']({ date: formatDate(connection.connected_at) })
					: '';
			case 'pending':
				return '';
			case 'access-lost':
				return m['integrations.card.accessLost.body']({ platform });
			default:
				return m['integrations.card.notConnected.body']({ platform });
		}
	});
</script>

<section
	class="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm"
	aria-labelledby={headingId}
>
	<div class="flex items-center gap-2">
		<Plug class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
		<SectionHeader title={platform} id={headingId} class="flex-1" />
		{#if view.kind === 'active'}
			<StatusBadge tone="success" label={m['integrations.card.connected']()} size="sm" />
		{/if}
	</div>

	<Card class="border-2 p-4 {CARD_TONE_CLASSES[view.tone]}">
		<div class="flex items-start gap-3">
			<div class="shrink-0 rounded-full p-2 {ICON_CHIP_CLASSES[view.tone]}">
				{#if view.kind === 'active'}
					<Check class="h-5 w-5" aria-hidden="true" />
				{:else if view.kind === 'access-lost'}
					<AlertCircle class="h-5 w-5" aria-hidden="true" />
				{:else}
					<Plug class="h-5 w-5" aria-hidden="true" />
				{/if}
			</div>
			<div class="min-w-0 flex-1 space-y-3">
				<div>
					<h3 class="font-bold text-foreground">{title}</h3>
					{#if body}
						<p class="mt-1 text-sm text-muted-foreground">{body}</p>
					{/if}
				</div>

				{#if view.kind === 'pending' && browser}
					<AccountPicker
						{organizationSlug}
						provider={connection.provider}
						{platform}
						onSelected={onChanged}
					/>
				{/if}

				{#if view.kind === 'active'}
					<label class="flex cursor-pointer items-start gap-2">
						<input
							type="checkbox"
							checked={autoSync}
							onchange={onAutoSyncChange}
							disabled={!browser || update.isPending}
							class="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-primary"
						/>
						<span>
							<span class="text-sm font-medium text-foreground"
								>{m['integrations.card.autoSync.label']()}</span
							>
							<span class="block text-xs text-muted-foreground"
								>{m['integrations.card.autoSync.help']({ platform })}</span
							>
						</span>
					</label>
				{/if}
			</div>
		</div>
	</Card>

	{#if view.liveUpdatesOff}
		<!-- No --warning token exists; highlight/amber IS the warning tone (StripeConnect precedent). -->
		<div
			class="flex items-start gap-3 rounded-lg border border-highlight/40 bg-highlight/20 p-4"
			role="alert"
		>
			<AlertTriangle
				class="mt-0.5 h-5 w-5 shrink-0 text-highlight-foreground dark:text-highlight"
				aria-hidden="true"
			/>
			<p class="text-sm text-highlight-foreground dark:text-highlight">
				{m['integrations.card.liveUpdatesOff']()}
			</p>
		</div>
	{/if}

	{#if actionError}
		<div
			class="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3"
			role="alert"
		>
			<AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
			<div class="min-w-0 text-sm text-foreground">
				<p>{actionError.message}</p>
				{#if actionError.providerMessage}
					<details class="mt-1 text-xs text-muted-foreground">
						<summary class="cursor-pointer"
							>{m['integrations.card.detailsFromPlatform']({ platform })}</summary
						>
						<p class="mt-1 break-words">{actionError.providerMessage}</p>
					</details>
				{/if}
			</div>
		</div>
	{/if}

	<div class="flex flex-wrap items-center gap-3">
		{#if view.canConnect}
			<Button
				onclick={startConnect}
				disabled={!browser || connect.isPending}
				class="inline-flex items-center gap-2"
			>
				{#if connect.isPending}
					<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
					{m['integrations.card.connecting']({ platform })}
				{:else}
					<ExternalLink class="h-4 w-4" aria-hidden="true" />
					{view.kind === 'access-lost'
						? m['integrations.card.reconnect']()
						: m['integrations.card.connect']({ platform })}
				{/if}
			</Button>
		{/if}
		{#if view.canDisconnect}
			<Button
				variant="outline"
				onclick={() => (showDisconnect = true)}
				disabled={!browser || disconnect.isPending}
				class="inline-flex items-center gap-2"
			>
				<Unplug class="h-4 w-4" aria-hidden="true" />
				{m['integrations.card.disconnect']()}
			</Button>
		{/if}
	</div>
</section>

<ConfirmDialog
	isOpen={showDisconnect}
	title={m['integrations.card.disconnect.title']({ platform })}
	message={m['integrations.card.disconnect.message']({ platform })}
	confirmText={m['integrations.card.disconnect.confirm']()}
	variant="danger"
	onConfirm={() => disconnect.mutate()}
	onCancel={() => (showDisconnect = false)}
/>
