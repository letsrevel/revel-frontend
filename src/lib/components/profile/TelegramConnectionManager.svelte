<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import {
		CheckCircle2,
		Loader2,
		MessageCircle,
		ExternalLink,
		AlertCircle,
		X
	} from 'lucide-svelte';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		telegramGetLinkStatus,
		telegramGetBotName,
		telegramConnectAccount,
		telegramDisconnectAccount
	} from '$lib/api/generated/sdk.gen';

	interface Props {
		authToken: string;
	}

	let { authToken }: Props = $props();

	const queryClient = useQueryClient();

	// Query for connection status
	const statusQuery = createQuery(() => ({
		queryKey: ['telegram', 'status'],
		queryFn: async () => {
			const result = await telegramGetLinkStatus({
				headers: { Authorization: `Bearer ${authToken}` }
			});
			return result.data;
		}
	}));

	// Query for bot name
	const botNameQuery = createQuery(() => ({
		queryKey: ['telegram', 'botname'],
		queryFn: async () => {
			const result = await telegramGetBotName({
				headers: { Authorization: `Bearer ${authToken}` }
			});
			return result.data;
		}
	}));

	// Connect mutation
	const connectMutation = createMutation(() => ({
		mutationFn: async (otp: string) => {
			const result = await telegramConnectAccount({
				headers: { Authorization: `Bearer ${authToken}` },
				body: { otp }
			});
			return result.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['telegram', 'status'] });
			showConnectDialog = false;
			otpValue = '';
			otpError = '';
		},
		onError: (error: any) => {
			const errorMessage = error?.message || 'Failed to connect Telegram account';
			otpError = errorMessage;
		}
	}));

	// Disconnect mutation
	const disconnectMutation = createMutation(() => ({
		mutationFn: async () => {
			await telegramDisconnectAccount({
				headers: { Authorization: `Bearer ${authToken}` }
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['telegram', 'status'] });
			showDisconnectConfirm = false;
		}
	}));

	// UI State
	let showConnectDialog = $state(false);
	let showDisconnectConfirm = $state(false);
	let otpValue = $state('');
	let otpError = $state('');

	// Derived state
	let isConnected = $derived(statusQuery.data?.connected ?? false);
	let telegramUsername = $derived(statusQuery.data?.telegram_username ?? null);
	let botName = $derived(botNameQuery.data?.botname ?? '');
	let botLink = $derived(botName ? `https://t.me/${botName}` : '');

	// Reset OTP when dialog closes
	$effect(() => {
		if (!showConnectDialog) {
			otpValue = '';
			otpError = '';
		}
	});

	function handleOpenConnectDialog() {
		showConnectDialog = true;
	}

	function handleCloseConnectDialog() {
		showConnectDialog = false;
	}

	function handleOpenDisconnectConfirm() {
		showDisconnectConfirm = true;
	}

	function handleCloseDisconnectConfirm() {
		showDisconnectConfirm = false;
	}

	function handleOtpInput(event: Event) {
		const input = event.target as HTMLInputElement;
		otpValue = input.value;
		otpError = '';
	}

	function handleConnectSubmit() {
		// Validate OTP (9-11 characters after removing spaces)
		const cleanedOtp = otpValue.replace(/\s/g, '');
		if (cleanedOtp.length !== 9) {
			otpError = m['telegram.connect_otpError']();
			return;
		}

		connectMutation.mutate(otpValue);
	}

	function handleDisconnect() {
		disconnectMutation.mutate();
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<MessageCircle class="h-6 w-6 text-[#0088cc]" aria-hidden="true" />
			<div>
				<h3 class="text-lg font-semibold">{m['telegram.heading']()}</h3>
				<p class="text-sm text-muted-foreground">
					{m['telegram.description']()}
				</p>
			</div>
		</div>

		{#if statusQuery.isLoading}
			<Loader2 class="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
		{:else if isConnected}
			<div class="flex items-center gap-2">
				<CheckCircle2 class="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
				<span class="text-sm font-medium text-green-600 dark:text-green-400">
					{m['telegram.status_connected']()}
				</span>
			</div>
		{/if}
	</div>

	{#if statusQuery.isLoading}
		<div class="flex items-center justify-center py-8">
			<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
		</div>
	{:else if isConnected && telegramUsername}
		<div
			class="rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950"
		>
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm font-medium text-green-800 dark:text-green-200">
						{m['telegram.status_connectedAs']({ username: `@${telegramUsername}` })}
					</p>
					<p class="mt-1 text-xs text-green-700 dark:text-green-300">
						{m['telegram.status_connectedDescription']()}
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					onclick={handleOpenDisconnectConfirm}
					disabled={disconnectMutation.isPending}
					class="border-green-300 hover:bg-green-100 dark:border-green-800 dark:hover:bg-green-900"
				>
					{#if disconnectMutation.isPending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{/if}
					{m['telegram.buttons_disconnect']()}
				</Button>
			</div>
		</div>
	{:else}
		<div class="rounded-md border border-border bg-muted/50 p-4">
			<p class="mb-3 text-sm text-muted-foreground">
				{m['telegram.notConnected_description']()}
			</p>
			<Button onclick={handleOpenConnectDialog} class="bg-[#0088cc] hover:bg-[#0088cc]/90">
				<MessageCircle class="mr-2 h-4 w-4" aria-hidden="true" />
				{m['telegram.buttons_connect']()}
			</Button>
		</div>
	{/if}
</div>

<!-- Connect Dialog -->
<Dialog bind:open={showConnectDialog}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>{m['telegram.connect_title']()}</DialogTitle>
			<DialogDescription>
				{m['telegram.connect_description']()}
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-4">
			<!-- Step 1: Open Telegram -->
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<span
						class="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
					>
						1
					</span>
					<span class="text-sm font-medium">{m['telegram.connect_step1']()}</span>
				</div>
				<div class="ml-8">
					{#if botNameQuery.isLoading}
						<div class="flex items-center gap-2">
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
							<span class="text-sm text-muted-foreground">Loading bot information...</span>
						</div>
					{:else if botLink}
						<a
							href={botLink}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-2 text-sm text-[#0088cc] underline-offset-4 hover:underline"
						>
							<MessageCircle class="h-4 w-4" aria-hidden="true" />
							<span>@{botName}</span>
							<ExternalLink class="h-3 w-3" aria-hidden="true" />
						</a>
					{:else}
						<p class="text-sm text-muted-foreground">
							Unable to load bot information. Please try again later.
						</p>
					{/if}
				</div>
			</div>

			<!-- Step 2: Send command -->
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<span
						class="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
					>
						2
					</span>
					<span class="text-sm font-medium">{m['telegram.connect_step2']()}</span>
				</div>
				<div class="ml-8">
					<code class="rounded bg-muted px-2 py-1 font-mono text-sm text-foreground">/connect</code>
				</div>
			</div>

			<!-- Step 3: Enter OTP -->
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<span
						class="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
					>
						3
					</span>
					<span class="text-sm font-medium">{m['telegram.connect_step3']()}</span>
				</div>
				<div class="ml-8 space-y-2">
					<Label for="otp">{m['telegram.connect_otpLabel']()}</Label>
					<Input
						id="otp"
						type="text"
						placeholder="123 456 789"
						value={otpValue}
						oninput={handleOtpInput}
						maxlength={11}
						aria-invalid={!!otpError}
						aria-describedby={otpError ? 'otp-error' : undefined}
						disabled={connectMutation.isPending}
						class={otpError ? 'border-destructive' : ''}
					/>
					{#if otpError}
						<p id="otp-error" class="text-sm text-destructive" role="alert">
							<AlertCircle class="mr-1 inline h-3 w-3" aria-hidden="true" />
							{otpError}
						</p>
					{/if}
				</div>
			</div>

			{#if connectMutation.isError}
				<Alert variant="destructive">
					<AlertCircle class="h-4 w-4" />
					<AlertDescription>
						{connectMutation.error?.message || m['telegram.connect_errorGeneric']()}
					</AlertDescription>
				</Alert>
			{/if}
		</div>

		<DialogFooter class="flex-col gap-2 sm:flex-row sm:justify-between">
			<Button
				type="button"
				variant="outline"
				onclick={handleCloseConnectDialog}
				disabled={connectMutation.isPending}
				class="w-full sm:w-auto"
			>
				{m['telegram.buttons_cancel']()}
			</Button>
			<Button
				type="button"
				onclick={handleConnectSubmit}
				disabled={connectMutation.isPending || !otpValue.trim()}
				class="w-full bg-[#0088cc] hover:bg-[#0088cc]/90 sm:w-auto"
			>
				{#if connectMutation.isPending}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{m['telegram.buttons_connecting']()}
				{:else}
					{m['telegram.buttons_connect']()}
				{/if}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<!-- Disconnect Confirmation Dialog -->
<Dialog bind:open={showDisconnectConfirm}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>{m['telegram.disconnect_title']()}</DialogTitle>
			<DialogDescription>
				{m['telegram.disconnect_description']()}
			</DialogDescription>
		</DialogHeader>

		<Alert>
			<AlertCircle class="h-4 w-4" />
			<AlertDescription>
				{m['telegram.disconnect_warning']()}
			</AlertDescription>
		</Alert>

		<DialogFooter class="flex-col gap-2 sm:flex-row sm:justify-end">
			<Button
				type="button"
				variant="outline"
				onclick={handleCloseDisconnectConfirm}
				disabled={disconnectMutation.isPending}
				class="w-full sm:w-auto"
			>
				{m['telegram.buttons_cancel']()}
			</Button>
			<Button
				type="button"
				variant="destructive"
				onclick={handleDisconnect}
				disabled={disconnectMutation.isPending}
				class="w-full sm:w-auto"
			>
				{#if disconnectMutation.isPending}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{m['telegram.buttons_disconnecting']()}
				{:else}
					{m['telegram.buttons_disconnectConfirm']()}
				{/if}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
