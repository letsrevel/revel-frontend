<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { User, AlertCircle } from 'lucide-svelte';

	interface Props {
		guestNames: string[];
		quantity: number;
		isProcessing: boolean;
		guestNameError: string;
		onUpdateName: (index: number, value: string) => void;
		onClearError: () => void;
	}

	let { guestNames, quantity, isProcessing, guestNameError, onUpdateName, onClearError }: Props =
		$props();
</script>

<div class="space-y-3 rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
	<div class="flex items-center gap-2">
		<User class="h-5 w-5 text-primary" aria-hidden="true" />
		<Label class="text-base font-semibold">
			{quantity === 1 ? 'Ticket Holder' : 'Ticket Holders'}
		</Label>
		<span class="text-sm text-destructive">*</span>
	</div>
	<p class="text-sm text-muted-foreground">
		{quantity === 1
			? 'Please enter your name for the ticket'
			: 'Please enter a name for each ticket holder'}
	</p>
	<div class="space-y-2">
		{#each guestNames as name, index (index)}
			<div class="flex items-center gap-2">
				<span
					class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary"
				>
					{index + 1}
				</span>
				<Input
					type="text"
					value={name}
					oninput={(e) => {
						onUpdateName(index, e.currentTarget.value);
						onClearError();
					}}
					placeholder={index === 0 ? 'Your name' : `Guest ${index + 1} name`}
					disabled={isProcessing}
					class="flex-1"
					required
					aria-invalid={guestNameError && !name.trim() ? 'true' : 'false'}
				/>
			</div>
		{/each}
	</div>
	{#if guestNameError}
		<Alert variant="destructive">
			<AlertCircle class="h-4 w-4" />
			<AlertDescription>{guestNameError}</AlertDescription>
		</Alert>
	{/if}
</div>
