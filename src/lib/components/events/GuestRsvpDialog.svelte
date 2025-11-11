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
	import { RadioGroup, RadioGroupItem } from '$lib/components/ui/radio-group';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { UserPlus, CheckCircle2, AlertCircle } from 'lucide-svelte';
	import { guestRsvpSchema, type GuestRsvpData } from '$lib/schemas/guestAttendance';
	import { eventGuestRsvp } from '$lib/api';
	import { handleGuestAttendanceError } from '$lib/utils/guestAttendance';

	interface Props {
		open: boolean;
		eventId: string;
		eventName: string;
		onClose: () => void;
		onSuccess?: () => void;
	}

	let { open = $bindable(), eventId, eventName, onClose, onSuccess }: Props = $props();

	// Form state
	let formData = $state<GuestRsvpData>({
		email: '',
		first_name: '',
		last_name: '',
		answer: 'yes'
	});

	// UI state
	let isSubmitting = $state(false);
	let showSuccess = $state(false);
	let errorMessage = $state<string | null>(null);

	// Validation errors (field-specific)
	let fieldErrors = $state<Partial<Record<keyof GuestRsvpData, string>>>({});

	// Reset state when dialog opens/closes
	$effect(() => {
		if (!open) {
			formData = {
				email: '',
				first_name: '',
				last_name: '',
				answer: 'yes'
			};
			fieldErrors = {};
			errorMessage = null;
			showSuccess = false;
		}
	});

	// Validate individual field
	function validateField(field: keyof GuestRsvpData) {
		try {
			const fieldSchema = guestRsvpSchema.shape[field];
			fieldSchema.parse(formData[field]);
			fieldErrors[field] = '';
		} catch (error: any) {
			if (error.errors && error.errors.length > 0) {
				fieldErrors[field] = error.errors[0].message;
			}
		}
	}

	// Handle input blur for validation
	function handleBlur(field: keyof GuestRsvpData) {
		validateField(field);
	}

	// Validate entire form
	function validateForm(): boolean {
		fieldErrors = {};
		errorMessage = null;

		try {
			guestRsvpSchema.parse(formData);
			return true;
		} catch (error: any) {
			if (error.errors) {
				error.errors.forEach((err: any) => {
					const field = err.path[0] as keyof GuestRsvpData;
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
			const response = await eventGuestRsvp({
				path: { event_id: eventId, answer: formData.answer },
				body: {
					email: formData.email,
					first_name: formData.first_name,
					last_name: formData.last_name
				}
			});

			// Success - show confirmation message
			showSuccess = true;
			onSuccess?.();
		} catch (error: any) {
			errorMessage = handleGuestAttendanceError(error);
		} finally {
			isSubmitting = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !isSubmitting && !showSuccess) {
			e.preventDefault();
			handleSubmit();
		}
	}

	// Get RSVP answer display text
	function getRsvpAnswerText(answer: 'yes' | 'no' | 'maybe'): string {
		switch (answer) {
			case 'yes':
				return m["guest_attendance.rsvp_yes"]();
			case 'no':
				return m["guest_attendance.rsvp_no"]();
			case 'maybe':
				return m["guest_attendance.rsvp_maybe"]();
		}
	}
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-lg">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2 text-xl">
				<UserPlus class="h-5 w-5 text-primary" aria-hidden="true" />
				{m["guest_attendance.rsvp_title"]()}
			</DialogTitle>
			<DialogDescription>
				{m["guest_attendance.rsvp_description"]()}
			</DialogDescription>
		</DialogHeader>

		{#if showSuccess}
			<!-- Success State -->
			<div class="space-y-4 py-6">
				<div class="flex flex-col items-center justify-center space-y-3 text-center">
					<div class="rounded-full bg-primary/10 p-3">
						<CheckCircle2 class="h-8 w-8 text-primary" aria-hidden="true" />
					</div>
					<div class="space-y-1">
						<h3 class="text-lg font-semibold">{m["guest_attendance.rsvp_email_sent_title"]()}</h3>
						<p class="text-sm text-muted-foreground">
							{m["guest_attendance.rsvp_email_sent_body"]({ email: formData.email })}
						</p>
					</div>
				</div>
			</div>

			<DialogFooter>
				<Button onclick={onClose} class="w-full">
					{m["guest_attendance.common_close"]()}
				</Button>
			</DialogFooter>
		{:else}
			<!-- Form State -->
			<form onsubmit={handleSubmit}>
				<div class="space-y-4 py-2">
					<!-- Email Field -->
					<div class="space-y-2">
						<Label for="guest-email">{m["guest_attendance.email_label"]()}</Label>
						<Input
							id="guest-email"
							type="email"
							bind:value={formData.email}
							onkeydown={handleKeydown}
							onblur={() => handleBlur('email')}
							placeholder={m["guest_attendance.email_placeholder"]()}
							disabled={isSubmitting}
							aria-invalid={fieldErrors.email ? 'true' : 'false'}
							aria-describedby={fieldErrors.email ? 'email-error email-hint' : 'email-hint'}
							autocomplete="email"
							required
						/>
						<p id="email-hint" class="text-xs text-muted-foreground">
							{m["guest_attendance.email_hint"]()}
						</p>
						{#if fieldErrors.email}
							<p id="email-error" class="text-sm text-destructive" role="alert">
								{fieldErrors.email}
							</p>
						{/if}
					</div>

					<!-- First Name and Last Name (side by side on larger screens) -->
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-2">
							<Label for="guest-first-name">{m["guest_attendance.first_name_label"]()}</Label>
							<Input
								id="guest-first-name"
								type="text"
								bind:value={formData.first_name}
								onkeydown={handleKeydown}
								onblur={() => handleBlur('first_name')}
								placeholder={m["guest_attendance.first_name_placeholder"]()}
								disabled={isSubmitting}
								aria-invalid={fieldErrors.first_name ? 'true' : 'false'}
								aria-describedby={fieldErrors.first_name ? 'first-name-error' : undefined}
								autocomplete="given-name"
								required
							/>
							{#if fieldErrors.first_name}
								<p id="first-name-error" class="text-sm text-destructive" role="alert">
									{fieldErrors.first_name}
								</p>
							{/if}
						</div>

						<div class="space-y-2">
							<Label for="guest-last-name">{m["guest_attendance.last_name_label"]()}</Label>
							<Input
								id="guest-last-name"
								type="text"
								bind:value={formData.last_name}
								onkeydown={handleKeydown}
								onblur={() => handleBlur('last_name')}
								placeholder={m["guest_attendance.last_name_placeholder"]()}
								disabled={isSubmitting}
								aria-invalid={fieldErrors.last_name ? 'true' : 'false'}
								aria-describedby={fieldErrors.last_name ? 'last-name-error' : undefined}
								autocomplete="family-name"
								required
							/>
							{#if fieldErrors.last_name}
								<p id="last-name-error" class="text-sm text-destructive" role="alert">
									{fieldErrors.last_name}
								</p>
							{/if}
						</div>
					</div>

					<!-- RSVP Answer -->
					<div class="space-y-3">
						<Label>{m["guest_attendance.rsvp_answer_label"]()}</Label>
						<RadioGroup bind:value={formData.answer} disabled={isSubmitting} class="space-y-2">
							{#each ['yes', 'no', 'maybe'] as option}
								<div class="flex items-center space-x-2">
									<RadioGroupItem value={option} id="rsvp-{option}" />
									<Label
										for="rsvp-{option}"
										class="font-normal cursor-pointer text-base leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
									>
										{getRsvpAnswerText(option as 'yes' | 'no' | 'maybe')}
									</Label>
								</div>
							{/each}
						</RadioGroup>
						{#if fieldErrors.answer}
							<p class="text-sm text-destructive" role="alert">
								{fieldErrors.answer}
							</p>
						{/if}
					</div>

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

				<DialogFooter class="gap-2 sm:gap-0 pt-4">
					<Button
						type="button"
						variant="outline"
						onclick={onClose}
						disabled={isSubmitting}
						class="flex-1 sm:flex-initial"
					>
						{m["guest_attendance.common_cancel"]()}
					</Button>
					<Button type="submit" disabled={isSubmitting} class="flex-1 sm:flex-initial">
						{#if isSubmitting}
							{m["guest_attendance.submitting"]()}
						{:else}
							{m["guest_attendance.submit_rsvp"]()}
						{/if}
					</Button>
				</DialogFooter>

				<!-- Subtle login link -->
				<div class="border-t pt-3 text-center text-xs text-muted-foreground">
					<p>
						{@html m["guest_attendance.or_login"]()
							.replace('<a>', '<a href="/login" class="text-primary hover:underline">')
							.replace('</a>', '</a>')}
					</p>
				</div>
			</form>
		{/if}
	</DialogContent>
</Dialog>
