<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import { Shield, CheckCircle, XCircle, AlertCircle, Copy, Check } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import TwoFactorInput from '$lib/components/forms/TwoFactorInput.svelte';
	import type { PageData, ActionData } from './$types';
	import QRCode from 'qrcode';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	// State management
	let isEnabling = $state(false);
	let isDisabling = $state(false);
	let showSetupFlow = $state(false);
	let showDisableFlow = $state(false);
	let qrCodeDataUrl = $state<string>('');
	let otpCode = $state('');
	let isSubmitting = $state(false);
	let manualEntryCopied = $state(false);

	// Derived state
	let totpActive = $derived(data.totpActive);
	let provisioningUri = $derived(form?.provisioningUri);
	let setupSuccess = $derived(form?.verified);
	let disableSuccess = $derived(form?.disabled);

	// Extract manual entry code from provisioning URI
	let manualEntryCode = $derived.by(() => {
		if (!provisioningUri) return '';
		const match = provisioningUri.match(/secret=([A-Z0-9]+)/);
		return match ? match[1] : '';
	});

	// Generate QR code when provisioning URI is available
	$effect(() => {
		if (provisioningUri && !qrCodeDataUrl) {
			QRCode.toDataURL(provisioningUri, { width: 256, margin: 2 })
				.then((url) => {
					qrCodeDataUrl = url;
				})
				.catch((err) => {
					console.error('Failed to generate QR code:', err);
					toast.error('Failed to generate QR code');
				});
		}
	});

	// Handle successful setup/disable
	$effect(() => {
		if (setupSuccess) {
			toast.success(form?.message || '2FA enabled successfully!');
			showSetupFlow = false;
			qrCodeDataUrl = '';
			otpCode = '';
			// Invalidate to refresh user data and show updated status
			invalidate('app:user');
		}
	});

	$effect(() => {
		if (disableSuccess) {
			toast.success(form?.message || '2FA disabled successfully!');
			showDisableFlow = false;
			otpCode = '';
			// Invalidate to refresh user data
			invalidate('app:user');
		}
	});

	// Copy manual entry code to clipboard
	async function copyManualCode() {
		const code = manualEntryCode;
		if (!code) return;

		try {
			await navigator.clipboard.writeText(code);
			manualEntryCopied = true;
			toast.success('Code copied to clipboard');
			setTimeout(() => {
				manualEntryCopied = false;
			}, 2000);
		} catch (err) {
			toast.error('Failed to copy code');
		}
	}

	// Cancel setup flow
	function cancelSetup() {
		showSetupFlow = false;
		qrCodeDataUrl = '';
		otpCode = '';
		isEnabling = false;
	}

	// Cancel disable flow
	function cancelDisable() {
		showDisableFlow = false;
		otpCode = '';
		isDisabling = false;
	}
</script>

<svelte:head>
	<title>Security Settings - Revel</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<!-- Page Header -->
	<div class="mb-8">
		<h1 class="text-3xl font-bold">Security Settings</h1>
		<p class="mt-2 text-muted-foreground">
			Manage your account security and two-factor authentication
		</p>
	</div>

	<!-- 2FA Section -->
	<div class="rounded-lg border bg-card p-6">
		<div class="flex items-start gap-4">
			<div
				class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
			>
				<Shield class="h-6 w-6" aria-hidden="true" />
			</div>

			<div class="flex-1">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-xl font-semibold">Two-Factor Authentication (2FA)</h2>
						<p class="mt-1 text-sm text-muted-foreground">
							Add an extra layer of security to your account using a TOTP authenticator app
						</p>
					</div>

					<!-- Status Badge -->
					<div
						class="flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium {totpActive
							? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
							: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}"
					>
						{#if totpActive}
							<CheckCircle class="h-4 w-4" aria-hidden="true" />
							<span>Enabled</span>
						{:else}
							<XCircle class="h-4 w-4" aria-hidden="true" />
							<span>Disabled</span>
						{/if}
					</div>
				</div>

				<!-- Enable/Disable Button (when not in a flow) -->
				{#if !showSetupFlow && !showDisableFlow}
					<div class="mt-6">
						{#if totpActive}
							<button
								type="button"
								class="rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2"
								onclick={() => {
									showDisableFlow = true;
								}}
							>
								Disable 2FA
							</button>
						{:else}
							<form
								method="POST"
								action="?/setup"
								use:enhance={() => {
									isEnabling = true;
									return async ({ result }) => {
										isEnabling = false;
										if (result.type === 'success') {
											showSetupFlow = true;
										} else if (result.type === 'failure') {
											const errors = result.data?.errors;
											toast.error(errors?.form || 'Failed to start 2FA setup');
										}
									};
								}}
							>
								<button
									type="submit"
									disabled={isEnabling}
									class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
								>
									{isEnabling ? 'Loading...' : 'Enable 2FA'}
								</button>
							</form>
						{/if}
					</div>
				{/if}

				<!-- Setup Flow -->
				{#if showSetupFlow && provisioningUri}
					<div class="mt-6 rounded-lg border bg-muted/50 p-6">
						<h3 class="font-semibold">Set up Two-Factor Authentication</h3>

						<!-- Step 1: Scan QR Code -->
						<div class="mt-4">
							<p class="text-sm text-muted-foreground">
								<span class="font-medium">Step 1:</span> Scan this QR code with your authenticator app
								(Google Authenticator, Authy, 1Password, etc.)
							</p>

							{#if qrCodeDataUrl}
								<div class="mt-4 flex justify-center">
									<img src={qrCodeDataUrl} alt="QR code for 2FA setup" class="rounded-lg" />
								</div>
							{:else}
								<div class="mt-4 flex justify-center">
									<div class="flex h-64 w-64 items-center justify-center rounded-lg bg-muted">
										<p class="text-sm text-muted-foreground">Generating QR code...</p>
									</div>
								</div>
							{/if}

							<!-- Manual Entry Option -->
							{#if manualEntryCode}
								<details class="mt-4">
									<summary class="cursor-pointer text-sm font-medium text-primary">
										Can't scan? Enter manually
									</summary>
									<div class="mt-2 rounded-md bg-background p-3">
										<p class="text-xs text-muted-foreground">Enter this code in your app:</p>
										<div class="mt-2 flex items-center gap-2">
											<code class="flex-1 rounded bg-muted px-3 py-2 font-mono text-sm">
												{manualEntryCode}
											</code>
											<button
												type="button"
												onclick={copyManualCode}
												class="rounded-md p-2 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
												aria-label="Copy code to clipboard"
											>
												{#if manualEntryCopied}
													<Check class="h-4 w-4 text-green-600" aria-hidden="true" />
												{:else}
													<Copy class="h-4 w-4" aria-hidden="true" />
												{/if}
											</button>
										</div>
									</div>
								</details>
							{/if}
						</div>

						<!-- Step 2: Verify Code -->
						<div class="mt-6">
							<p class="text-sm text-muted-foreground">
								<span class="font-medium">Step 2:</span> Enter the 6-digit code from your authenticator
								app to verify
							</p>

							<form
								method="POST"
								action="?/verify"
								use:enhance={() => {
									isSubmitting = true;
									return async ({ result }) => {
										isSubmitting = false;
										if (result.type === 'failure') {
											const errors = result.data?.errors;
											toast.error(errors?.code || errors?.form || 'Verification failed');
										}
									};
								}}
							>
								<div class="mt-4">
									<TwoFactorInput bind:value={otpCode} />
									{#if form?.errors?.code}
										<p class="mt-2 text-sm text-destructive" role="alert">
											{form.errors.code}
										</p>
									{/if}
								</div>

								<div class="mt-6 flex gap-3">
									<button
										type="submit"
										disabled={otpCode.length !== 6 || isSubmitting}
										class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
									>
										{isSubmitting ? 'Verifying...' : 'Verify and Enable 2FA'}
									</button>
									<button
										type="button"
										onclick={cancelSetup}
										class="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
									>
										Cancel
									</button>
								</div>
							</form>
						</div>
					</div>
				{/if}

				<!-- Disable Flow -->
				{#if showDisableFlow}
					<div class="mt-6 rounded-lg border border-destructive/50 bg-destructive/5 p-6">
						<div class="flex gap-3">
							<AlertCircle class="h-5 w-5 text-destructive" aria-hidden="true" />
							<div class="flex-1">
								<h3 class="font-semibold text-destructive">Disable Two-Factor Authentication</h3>
								<p class="mt-2 text-sm text-muted-foreground">
									Enter your current 6-digit code from your authenticator app to disable 2FA. This
									will make your account less secure.
								</p>

								<form
									method="POST"
									action="?/disable"
									use:enhance={() => {
										isSubmitting = true;
										return async ({ result }) => {
											isSubmitting = false;
											if (result.type === 'failure') {
												const errors = result.data?.errors;
												toast.error(errors?.code || errors?.form || 'Failed to disable 2FA');
											}
										};
									}}
								>
									<div class="mt-4">
										<TwoFactorInput bind:value={otpCode} />
										{#if form?.errors?.code}
											<p class="mt-2 text-sm text-destructive" role="alert">
												{form.errors.code}
											</p>
										{/if}
									</div>

									<div class="mt-6 flex gap-3">
										<button
											type="submit"
											disabled={otpCode.length !== 6 || isSubmitting}
											class="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2 disabled:opacity-50"
										>
											{isSubmitting ? 'Disabling...' : 'Disable 2FA'}
										</button>
										<button
											type="button"
											onclick={cancelDisable}
											class="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
										>
											Cancel
										</button>
									</div>
								</form>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Additional Security Tips -->
	<div class="mt-6 rounded-lg border bg-muted/50 p-6">
		<h3 class="font-semibold">Security Tips</h3>
		<ul class="mt-3 space-y-2 text-sm text-muted-foreground">
			<li class="flex gap-2">
				<CheckCircle class="h-5 w-5 flex-shrink-0 text-green-600" aria-hidden="true" />
				<span>Use a strong, unique password for your Revel account</span>
			</li>
			<li class="flex gap-2">
				<CheckCircle class="h-5 w-5 flex-shrink-0 text-green-600" aria-hidden="true" />
				<span>Enable 2FA for an extra layer of security</span>
			</li>
			<li class="flex gap-2">
				<CheckCircle class="h-5 w-5 flex-shrink-0 text-green-600" aria-hidden="true" />
				<span>Never share your authentication codes with anyone</span>
			</li>
			<li class="flex gap-2">
				<CheckCircle class="h-5 w-5 flex-shrink-0 text-green-600" aria-hidden="true" />
				<span>Keep your authenticator app backed up securely</span>
			</li>
		</ul>
	</div>
</div>
