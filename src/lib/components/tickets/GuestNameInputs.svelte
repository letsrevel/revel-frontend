<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { User, AlertCircle } from '@lucide/svelte';

	interface Props {
		guestNames: string[];
		isProcessing: boolean;
		guestNameError: string;
		/** Prefixes every input/label/error id so two instances (one per cart group) never collide. */
		idPrefix: string;
		/** Overrides the default section label; omit to keep the generic one. */
		heading?: string;
		onUpdateName: (index: number, value: string) => void;
		onClearError: () => void;
	}

	const {
		guestNames,
		isProcessing,
		guestNameError,
		idPrefix,
		heading,
		onUpdateName,
		onClearError
	}: Props = $props();

	const errorId = $derived(`${idPrefix}-name-error`);
</script>

<div class="space-y-3 rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
	<div class="flex items-center gap-2">
		<User class="h-5 w-5 text-primary" aria-hidden="true" />
		<Label class="text-base font-semibold">{heading ?? m['cartSheet.namesHeading']()}</Label>
		<span class="text-sm text-destructive">*</span>
	</div>
	<div class="space-y-2">
		{#each guestNames as name, index (index)}
			<div class="flex items-center gap-2">
				<span
					class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary"
				>
					{index + 1}
				</span>
				<div class="flex-1 space-y-1">
					<Label for="{idPrefix}-name-{index}" class="sr-only">
						{m['cartSheet.nameLabel']({ index: index + 1 })}
					</Label>
					<Input
						id="{idPrefix}-name-{index}"
						type="text"
						value={name}
						oninput={(e) => {
							onUpdateName(index, e.currentTarget.value);
							onClearError();
						}}
						placeholder={m['cartSheet.nameLabel']({ index: index + 1 })}
						disabled={isProcessing}
						required
						aria-invalid={guestNameError && !name.trim() ? 'true' : 'false'}
						aria-describedby={guestNameError ? errorId : undefined}
					/>
				</div>
			</div>
		{/each}
	</div>
	{#if guestNameError}
		<Alert variant="destructive" id={errorId}>
			<AlertCircle class="h-4 w-4" />
			<AlertDescription>{guestNameError}</AlertDescription>
		</Alert>
	{/if}
</div>
