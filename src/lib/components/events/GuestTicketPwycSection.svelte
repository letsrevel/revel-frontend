<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import type { GuestTicketFormData } from '$lib/schemas/guestAttendance';

	interface Props {
		formData: GuestTicketFormData;
		fieldErrors: Record<string, string>;
		currency: string;
		minAmount: number;
		maxAmount: number | null;
		suggestions: number[];
		isSubmitting: boolean;
		onKeydown: (e: KeyboardEvent) => void;
		onBlur: (field: string) => void;
	}

	let {
		formData = $bindable(),
		fieldErrors = $bindable(),
		currency,
		minAmount,
		maxAmount,
		suggestions,
		isSubmitting,
		onKeydown,
		onBlur
	}: Props = $props();
</script>

<div class="space-y-3">
	<div class="space-y-2">
		<Label for="pwyc-amount">{m['guest_attendance.pwyc_label']()}</Label>
		<div class="text-xs text-muted-foreground">
			{maxAmount !== null
				? m['guest_attendance.pwyc_hint']({ min: minAmount, max: maxAmount })
				: m['guest_attendance.pwyc_hint_no_max']({ min: minAmount })}
		</div>
		<div class="relative">
			<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
				{currency}
			</span>
			<Input
				id="pwyc-amount"
				type="text"
				inputmode="decimal"
				value={formData.pwyc}
				oninput={(e) => {
					formData.pwyc = (e.currentTarget as HTMLInputElement).value
						.replace(/,/g, '.')
						.replace(/[^\d.]/g, '');
				}}
				onkeydown={onKeydown}
				onblur={() => onBlur('pwyc')}
				class="pl-12 text-lg font-semibold"
				placeholder={minAmount.toFixed(2)}
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
		<p class="text-sm font-medium">{m['guestTicketDialog.quickSelect']()}</p>
		<div class="grid grid-cols-3 gap-2">
			{#each suggestions as suggested, i (i)}
				{@const applySuggestion = () => {
					formData.pwyc = suggested.toFixed(2);
					fieldErrors.pwyc = '';
				}}
				<!-- pointerdown applies the amount before blur-triggered validation errors
				     shift the layout and make the subsequent click miss the button;
				     onclick stays for keyboard activation (idempotent double-fire is fine) -->
				<Button
					type="button"
					variant="outline"
					size="sm"
					onpointerdown={applySuggestion}
					onclick={applySuggestion}
					disabled={isSubmitting}
				>
					{currency}{suggested.toFixed(2)}
				</Button>
			{/each}
		</div>
	</div>
</div>
