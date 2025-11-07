<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { enhance, applyAction } from '$app/forms';
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

	// Debug logging - track all reactive changes
	$effect(() => {
		console.log('[2FA Debug] Reactive state changed:', {
			'form (full object)': form,
			provisioningUri: provisioningUri,
			setupSuccess: setupSuccess,
			disableSuccess: disableSuccess,
			showSetupFlow: showSetupFlow,
			totpActive: totpActive
		});
	});

	// Track showSetupFlow changes specifically
	$effect(() => {
		console.log('[2FA Debug] showSetupFlow changed to:', showSetupFlow);
	});

	// Track provisioningUri changes specifically
	$effect(() => {
		console.log('[2FA Debug] provisioningUri changed to:', provisioningUri);
	});

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
					toast.error(m['accountSecurityPage.toast_qrCodeError']());
				});
		}
	});

	// Handle successful setup/disable
	$effect(() => {
		if (setupSuccess) {
			toast.success(form?.message || m['accountSecurityPage.toast_2faEnabled']());
			showSetupFlow = false;
			qrCodeDataUrl = '';
			otpCode = '';
			// Invalidate to refresh user data and show updated status
			invalidate('app:user');
		}
	});

	$effect(() => {
		if (disableSuccess) {
			toast.success(form?.message || m['accountSecurityPage.toast_2faDisabled']());
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
			toast.success(m['accountSecurityPage.toast_codeCopied']());
			setTimeout(() => {
				manualEntryCopied = false;
			}, 2000);
		} catch (err) {
			toast.error(m['accountSecurityPage.toast_copyFailed']());
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
	}
</script>

<svelte:head>
	<title>{m['accountSecurityPage.pageTitle']()} - Revel</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<!-- Page Header -->
	<div class="mb-8">
		<h1 class="text-3xl font-bold">{m['accountSecurityPage.title']()}</h1>
		<p class="mt-2 text-muted-foreground">
			{m['accountSecurityPage.subtitle']()}
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
						<h2 class="text-xl font-semibold">{m['accountSecurityPage.twoFactorAuth']()}</h2>
						<p class="mt-1 text-sm text-muted-foreground">
							{m['accountSecurityPage.twoFactorDescription']()}
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
							<span>{m['accountSecurityPage.statusEnabled']()}</span>
						{:else}
							<XCircle class="h-4 w-4" aria-hidden="true" />
							<span>{m['accountSecurityPage.statusDisabled']()}</span>
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
								{m['accountSecurityPage.disable2FA']()}
							</button>
						{:else}
							<form
								method="POST"
								action="?/setup"
								use:enhance={() => {
									console.log('[2FA Setup] Form submission starting');
									isEnabling = true;
									return async ({ result }) => {
										console.log('[2FA Setup] Result received:', {
											type: result.type,
											status: 'status' in result ? result.status : undefined,
											data: 'data' in result ? result.data : undefined
										});
										isEnabling = false;
										if (result.type === 'success') {
											console.log('[2FA Setup] Success! Calling applyAction...');
											// Apply action to update form prop
											await applyAction(result);
											console.log('[2FA Setup] applyAction complete. Setting showSetupFlow = true');
											showSetupFlow = true;
											console.log('[2FA Setup] showSetupFlow set to:', showSetupFlow);
										} else if (result.type === 'failure' && result.data) {
											console.log('[2FA Setup] Failure:', result.data);
											await applyAction(result);
											const errors = (result.data as any)?.errors;
											toast.error(errors?.form || m['accountSecurityPage.toast_setupFailed']());
										}
									};
								}}
							>
								<button
									type="submit"
									disabled={isEnabling}
									class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
								>
									{isEnabling
										? m['accountSecurityPage.loading']()
										: m['accountSecurityPage.enable2FA']()}
								</button>
							</form>
						{/if}
					</div>
				{/if}

				<!-- Setup Flow -->
				{#if showSetupFlow}
					<div class="mt-6 rounded-lg border bg-muted/50 p-6">
						<h3 class="font-semibold">{m['accountSecurityPage.setupTitle']()}</h3>

						{#if provisioningUri}
							<!-- Step 1: Scan QR Code -->
							<div class="mt-4">
								<p class="text-sm text-muted-foreground">
									<span class="font-medium">{m['accountSecurityPage.step1']()}</span>
									{m['accountSecurityPage.step1Description']()}
								</p>

								{#if qrCodeDataUrl}
									<div class="mt-4 flex justify-center">
										<img
											src={qrCodeDataUrl}
											alt={m['accountSecurityPage.qrCodeAlt']()}
											class="rounded-lg"
										/>
									</div>
								{:else}
									<div class="mt-4 flex justify-center">
										<div class="flex h-64 w-64 items-center justify-center rounded-lg bg-muted">
											<p class="text-sm text-muted-foreground">
												{m['accountSecurityPage.generatingQR']()}
											</p>
										</div>
									</div>
								{/if}

								<!-- Manual Entry Option -->
								{#if manualEntryCode}
									<details class="mt-4">
										<summary class="cursor-pointer text-sm font-medium text-primary">
											{m['accountSecurityPage.cantScan']()}
										</summary>
										<div class="mt-2 rounded-md bg-background p-3">
											<p class="text-xs text-muted-foreground">
												{m['accountSecurityPage.enterCodeManually']()}
											</p>
											<div class="mt-2 flex items-center gap-2">
												<code class="flex-1 rounded bg-muted px-3 py-2 font-mono text-sm">
													{manualEntryCode}
												</code>
												<button
													type="button"
													onclick={copyManualCode}
													class="rounded-md p-2 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
													aria-label={m['accountSecurityPage.copyCodeLabel']()}
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
									<span class="font-medium">{m['accountSecurityPage.step2']()}</span>
									{m['accountSecurityPage.step2Description']()}
								</p>

								<form
									method="POST"
									action="?/verify"
									use:enhance={() => {
										isSubmitting = true;
										return async ({ result }) => {
											isSubmitting = false;
											await applyAction(result);
											if (result.type === 'failure' && result.data) {
												const errors = (result.data as any)?.errors;
												toast.error(
													errors?.code ||
														errors?.form ||
														m['accountSecurityPage.toast_verifyFailed']()
												);
											}
										};
									}}
								>
									<div class="mt-4">
										<TwoFactorInput bind:value={otpCode} />
										{#if form?.errors && 'code' in form.errors && form.errors.code}
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
											{isSubmitting
												? m['accountSecurityPage.verifying']()
												: m['accountSecurityPage.verifyButton']()}
										</button>
										<button
											type="button"
											onclick={cancelSetup}
											class="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
										>
											{m['accountSecurityPage.cancel']()}
										</button>
									</div>
								</form>
							</div>
						{:else}
							<!-- Loading provisioning URI -->
							<div class="mt-4 flex justify-center">
								<div class="flex h-64 w-64 items-center justify-center rounded-lg bg-muted">
									<p class="text-sm text-muted-foreground">
										{m['accountSecurityPage.loadingSetupData']()}
									</p>
								</div>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Disable Flow -->
				{#if showDisableFlow}
					<div class="mt-6 rounded-lg border border-destructive/50 bg-destructive/5 p-6">
						<div class="flex gap-3">
							<AlertCircle class="h-5 w-5 text-destructive" aria-hidden="true" />
							<div class="flex-1">
								<h3 class="font-semibold text-destructive">
									{m['accountSecurityPage.disableTitle']()}
								</h3>
								<p class="mt-2 text-sm text-muted-foreground">
									{m['accountSecurityPage.disableDescription']()}
								</p>

								<form
									method="POST"
									action="?/disable"
									use:enhance={() => {
										isSubmitting = true;
										return async ({ result }) => {
											isSubmitting = false;
											await applyAction(result);
											if (result.type === 'failure' && result.data) {
												const errors = (result.data as any)?.errors;
												toast.error(
													errors?.code ||
														errors?.form ||
														m['accountSecurityPage.toast_disableFailed']()
												);
											}
										};
									}}
								>
									<div class="mt-4">
										<TwoFactorInput bind:value={otpCode} />
										{#if form?.errors && 'code' in form.errors && form.errors.code}
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
											{isSubmitting
												? m['accountSecurityPage.disabling']()
												: m['accountSecurityPage.disableButton']()}
										</button>
										<button
											type="button"
											onclick={cancelDisable}
											class="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
										>
											{m['accountSecurityPage.cancel']()}
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
		<h3 class="font-semibold">{m['accountSecurityPage.securityTips']()}</h3>
		<ul class="mt-3 space-y-2 text-sm text-muted-foreground">
			<li class="flex gap-2">
				<CheckCircle class="h-5 w-5 flex-shrink-0 text-green-600" aria-hidden="true" />
				<span>{m['accountSecurityPage.tip1']()}</span>
			</li>
			<li class="flex gap-2">
				<CheckCircle class="h-5 w-5 flex-shrink-0 text-green-600" aria-hidden="true" />
				<span>{m['accountSecurityPage.tip2']()}</span>
			</li>
			<li class="flex gap-2">
				<CheckCircle class="h-5 w-5 flex-shrink-0 text-green-600" aria-hidden="true" />
				<span>{m['accountSecurityPage.tip3']()}</span>
			</li>
			<li class="flex gap-2">
				<CheckCircle class="h-5 w-5 flex-shrink-0 text-green-600" aria-hidden="true" />
				<span>{m['accountSecurityPage.tip4']()}</span>
			</li>
		</ul>
	</div>
</div>
