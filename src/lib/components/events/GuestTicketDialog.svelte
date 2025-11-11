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
	import { Ticket, CheckCircle2, AlertCircle, CreditCard, DollarSign } from 'lucide-svelte';
	import { guestUserSchema, createGuestPwycSchema } from '$lib/schemas/guestAttendance';
	import { eventGuestTicketCheckout, eventGuestTicketPwycCheckout } from '$lib/api';
	import { handleGuestAttendanceError } from '$lib/utils/guestAttendance';
	import type { TierSchemaWithId } from '$lib/types/tickets';

	interface Props {
		open: boolean;
		eventId: string;
		eventName: string;
		tier: TierSchemaWithId;
		onClose: () => void;
		onSuccess?: () => void;
	}

	let { open = $bindable(), eventId, eventName, tier, onClose, onSuccess }: Props = $props();

	// Form state
	let formData = $state<{
		email: string;
		first_name: string;
		last_name: string;
		pwyc?: string;
	}>({
		email: '',
		first_name: '',
		last_name: '',
		pwyc: ''
	});

	// UI state
	let isSubmitting = $state(false);
	let showSuccess = $state(false);
	let errorMessage = $state<string | null>(null);

	// Validation errors
	let fieldErrors = $state<Record<string, string>>({});

	// Computed values
	let isPwyc = $derived(tier.price_type === 'pwyc');
	let isOnlinePayment = $derived(tier.payment_method === 'online');

	// PWYC min/max
	let minAmount = $derived(() => {
		if (!isPwyc) return 0;
		if (tier.pwyc_min) {
			return typeof tier.pwyc_min === 'string' ? parseFloat(tier.pwyc_min) : tier.pwyc_min;
		}
		return 1;
	});

	let maxAmount = $derived(() => {
		if (!isPwyc || !tier.pwyc_max) return null;
		return typeof tier.pwyc_max === 'string' ? parseFloat(tier.pwyc_max) : tier.pwyc_max;
	});

	// Reset state when dialog opens/closes
	$effect(() => {
		if (!open) {
			formData = {
				email: '',
				first_name: '',
				last_name: '',
				pwyc: ''
			};
			fieldErrors = {};
			errorMessage = null;
			showSuccess = false;
		} else if (isPwyc) {
			// Set default PWYC amount
			formData.pwyc = minAmount().toFixed(2);
		}
	});

	// Validate field
	function validateField(field: string) {
		try {
			if (field === 'pwyc' && isPwyc) {
				const schema = createGuestPwycSchema({
					pwyc_min: minAmount(),
					pwyc_max: maxAmount()
				});
				const pwycNumber = parseFloat(formData.pwyc || '0');
				schema.shape.pwyc.parse(pwycNumber);
				fieldErrors.pwyc = '';
			} else {
				const fieldSchema = (guestUserSchema.shape as any)[field];
				if (fieldSchema) {
					fieldSchema.parse((formData as any)[field]);
					fieldErrors[field] = '';
				}
			}
		} catch (error: any) {
			if (error.errors && error.errors.length > 0) {
				fieldErrors[field] = error.errors[0].message;
			}
		}
	}

	function handleBlur(field: string) {
		validateField(field);
	}

	// Validate entire form
	function validateForm(): boolean {
		fieldErrors = {};
		errorMessage = null;

		try {
			if (isPwyc) {
				const schema = createGuestPwycSchema({
					pwyc_min: minAmount(),
					pwyc_max: maxAmount()
				});
				const pwycNumber = parseFloat(formData.pwyc || '0');
				schema.parse({
					email: formData.email,
					first_name: formData.first_name,
					last_name: formData.last_name,
					pwyc: pwycNumber
				});
			} else {
				guestUserSchema.parse({
					email: formData.email,
					first_name: formData.first_name,
					last_name: formData.last_name
				});
			}
			return true;
		} catch (error: any) {
			if (error.errors) {
				error.errors.forEach((err: any) => {
					const field = err.path[0];
					if (!fieldErrors[field]) {
						fieldErrors[field] = err.message;
					}
				});
			}
			return false;
		}
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!validateForm()) return;

		isSubmitting = true;
		errorMessage = null;

		try {
			let response;

			if (isPwyc) {
				// PWYC checkout
				const pwycNumber = parseFloat(formData.pwyc || '0');
				response = await eventGuestTicketPwycCheckout({
					path: { event_id: eventId, tier_id: tier.id },
					body: {
						email: formData.email,
						first_name: formData.first_name,
						last_name: formData.last_name,
						pwyc: pwycNumber
					}
				});
			} else {
				// Fixed-price checkout
				response = await eventGuestTicketCheckout({
					path: { event_id: eventId, tier_id: tier.id },
					body: {
						email: formData.email,
						first_name: formData.first_name,
						last_name: formData.last_name
					}
				});
			}

			// Check response type
			if (response.data && 'checkout_url' in response.data) {
				// Online payment - redirect to Stripe
				window.location.href = response.data.checkout_url;
			} else {
				// Email confirmation flow - show success
				showSuccess = true;
				onSuccess?.();
			}
		} catch (error: any) {
			errorMessage = handleGuestAttendanceError(error);
		} finally {
			isSubmitting = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !isSubmitting && !showSuccess) {
			e.preventDefault();
			// Create a synthetic submit event
			const form = (e.target as HTMLElement).closest('form');
			if (form) {
				form.requestSubmit();
			}
		}
	}

	// Quick PWYC suggestions
	function getSuggestions(min: number, max: number | null): number[] {
		if (max !== null) {
			return [min, Math.round((min + max) / 2), max];
		}
		return [min, min * 2, min * 3];
	}
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-lg">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2 text-xl">
				<Ticket class="h-5 w-5 text-primary" aria-hidden="true" />
				{m['guest_attendance.ticket_title']()}
			</DialogTitle>
			<DialogDescription>
				{m['guest_attendance.ticket_description']()}
			</DialogDescription>
		</DialogHeader>

		{#if showSuccess}
			<!-- Success State (Email Confirmation) -->
			<div class="space-y-4 py-6">
				<div class="flex flex-col items-center justify-center space-y-3 text-center">
					<div class="rounded-full bg-primary/10 p-3">
						<CheckCircle2 class="h-8 w-8 text-primary" aria-hidden="true" />
					</div>
					<div class="space-y-1">
						<h3 class="text-lg font-semibold">{m['guest_attendance.ticket_email_sent_title']()}</h3>
						<p class="text-sm text-muted-foreground">
							{m['guest_attendance.ticket_email_sent_body']({ email: formData.email })}
						</p>
					</div>
				</div>
			</div>

			<DialogFooter>
				<Button onclick={onClose} class="w-full">
					{m['guest_attendance.common_close']()}
				</Button>
			</DialogFooter>
		{:else}
			<!-- Form State -->
			<form onsubmit={handleSubmit}>
				<div class="space-y-4 py-2">
					<!-- Tier Info Card -->
					<div class="rounded-lg border border-border bg-muted/50 p-4">
						<div class="flex items-start justify-between gap-4">
							<div class="flex-1 space-y-1">
								<h3 class="font-semibold">{tier.name}</h3>
								{#if tier.description}
									<p class="text-sm text-muted-foreground">{tier.description}</p>
								{/if}
								{#if !isPwyc}
									<p class="text-lg font-bold text-primary">
										{tier.currency}
										{typeof tier.price === 'string'
											? parseFloat(tier.price).toFixed(2)
											: tier.price?.toFixed(2) || '0.00'}
									</p>
								{/if}
							</div>
							<Ticket class="h-8 w-8 shrink-0 text-muted-foreground" aria-hidden="true" />
						</div>
					</div>

					<!-- Email Field -->
					<div class="space-y-2">
						<Label for="guest-ticket-email">{m['guest_attendance.email_label']()}</Label>
						<Input
							id="guest-ticket-email"
							type="email"
							bind:value={formData.email}
							onkeydown={handleKeydown}
							onblur={() => handleBlur('email')}
							placeholder={m['guest_attendance.email_placeholder']()}
							disabled={isSubmitting}
							aria-invalid={fieldErrors.email ? 'true' : 'false'}
							aria-describedby={fieldErrors.email
								? 'ticket-email-error ticket-email-hint'
								: 'ticket-email-hint'}
							autocomplete="email"
							required
						/>
						<p id="ticket-email-hint" class="text-xs text-muted-foreground">
							{m['guest_attendance.email_hint']()}
						</p>
						{#if fieldErrors.email}
							<p id="ticket-email-error" class="text-sm text-destructive" role="alert">
								{fieldErrors.email}
							</p>
						{/if}
					</div>

					<!-- First Name and Last Name -->
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-2">
							<Label for="guest-ticket-first-name">{m['guest_attendance.first_name_label']()}</Label
							>
							<Input
								id="guest-ticket-first-name"
								type="text"
								bind:value={formData.first_name}
								onkeydown={handleKeydown}
								onblur={() => handleBlur('first_name')}
								placeholder={m['guest_attendance.first_name_placeholder']()}
								disabled={isSubmitting}
								aria-invalid={fieldErrors.first_name ? 'true' : 'false'}
								aria-describedby={fieldErrors.first_name ? 'ticket-first-name-error' : undefined}
								autocomplete="given-name"
								required
							/>
							{#if fieldErrors.first_name}
								<p id="ticket-first-name-error" class="text-sm text-destructive" role="alert">
									{fieldErrors.first_name}
								</p>
							{/if}
						</div>

						<div class="space-y-2">
							<Label for="guest-ticket-last-name">{m['guest_attendance.last_name_label']()}</Label>
							<Input
								id="guest-ticket-last-name"
								type="text"
								bind:value={formData.last_name}
								onkeydown={handleKeydown}
								onblur={() => handleBlur('last_name')}
								placeholder={m['guest_attendance.last_name_placeholder']()}
								disabled={isSubmitting}
								aria-invalid={fieldErrors.last_name ? 'true' : 'false'}
								aria-describedby={fieldErrors.last_name ? 'ticket-last-name-error' : undefined}
								autocomplete="family-name"
								required
							/>
							{#if fieldErrors.last_name}
								<p id="ticket-last-name-error" class="text-sm text-destructive" role="alert">
									{fieldErrors.last_name}
								</p>
							{/if}
						</div>
					</div>

					<!-- PWYC Amount (if applicable) -->
					{#if isPwyc}
						<div class="space-y-3">
							<div class="space-y-2">
								<Label for="pwyc-amount">{m['guest_attendance.pwyc_label']()}</Label>
								<div class="text-xs text-muted-foreground">
									{maxAmount() !== null
										? m['guest_attendance.pwyc_hint']({ min: minAmount(), max: maxAmount()! })
										: m['guest_attendance.pwyc_hint_no_max']({ min: minAmount() })}
								</div>
								<div class="relative">
									<span
										class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
									>
										{tier.currency}
									</span>
									<Input
										id="pwyc-amount"
										type="number"
										min={minAmount()}
										max={maxAmount() ?? undefined}
										step="0.01"
										bind:value={formData.pwyc}
										onkeydown={handleKeydown}
										onblur={() => handleBlur('pwyc')}
										class="pl-12 text-lg font-semibold"
										placeholder={minAmount().toFixed(2)}
										disabled={isSubmitting}
										aria-invalid={fieldErrors.pwyc ? 'true' : 'false'}
										aria-describedby={fieldErrors.pwyc ? 'pwyc-error' : undefined}
									/>
								</div>
								{#if fieldErrors.pwyc}
									<p id="pwyc-error" class="text-sm text-destructive" role="alert">
										{fieldErrors.pwyc}
									</p>
								{/if}
							</div>

							<!-- Quick Amount Suggestions -->
							<div class="space-y-2">
								<p class="text-sm font-medium">Quick Select</p>
								<div class="grid grid-cols-3 gap-2">
									{#each getSuggestions(minAmount(), maxAmount()) as suggested}
										<Button
											type="button"
											variant="outline"
											size="sm"
											onclick={() => {
												formData.pwyc = suggested.toFixed(2);
												fieldErrors.pwyc = '';
											}}
											disabled={isSubmitting}
										>
											{tier.currency}{suggested.toFixed(2)}
										</Button>
									{/each}
								</div>
							</div>
						</div>
					{/if}

					<!-- Online Payment Notice -->
					{#if isOnlinePayment}
						<Alert>
							<CreditCard class="h-4 w-4" />
							<AlertDescription>
								<p class="text-sm">
									You'll be redirected to our secure payment provider to complete your purchase.
								</p>
							</AlertDescription>
						</Alert>
					{/if}

					<!-- Error Message -->
					{#if errorMessage}
						<Alert variant="destructive">
							<AlertCircle class="h-4 w-4" />
							<AlertDescription>
								{errorMessage}
							</AlertDescription>
						</Alert>
					{/if}
				</div>

				<DialogFooter class="gap-2 pt-4 sm:gap-0">
					<Button
						type="button"
						variant="outline"
						onclick={onClose}
						disabled={isSubmitting}
						class="flex-1 sm:flex-initial"
					>
						{m['guest_attendance.common_cancel']()}
					</Button>
					<Button type="submit" disabled={isSubmitting} class="flex-1 sm:flex-initial">
						{#if isSubmitting}
							{m['guest_attendance.submitting']()}
						{:else}
							{m['guest_attendance.submit_ticket']()}
						{/if}
					</Button>
				</DialogFooter>

				<!-- Subtle login link -->
				<div class="border-t pt-3 text-center text-xs text-muted-foreground">
					<p>
						{@html m['guest_attendance.or_login']()
							.replace('<a>', '<a href="/login" class="text-primary hover:underline">')
							.replace('</a>', '</a>')}
					</p>
				</div>
			</form>
		{/if}
	</DialogContent>
</Dialog>
