<script lang="ts">
	interface Props {
		value: string;
		error?: string;
		disabled?: boolean;
		onInput?: (value: string) => void;
	}

	let { value = $bindable(''), error, disabled = false, onInput }: Props = $props();

	let inputs: HTMLInputElement[] = [];

	// Create array of 6 digit slots - always render all 6 inputs
	let digits = $derived.by(() => {
		const valueDigits = value.split('').slice(0, 6);
		// Always return exactly 6 items, filling with empty strings
		return Array.from({ length: 6 }, (_, i) => valueDigits[i] || '');
	});

	function updateValue(newDigits: string[]) {
		const newValue = newDigits.join('');
		value = newValue;
		onInput?.(newValue);
	}

	function handleInput(index: number, event: Event) {
		const input = event.target as HTMLInputElement;
		const val = input.value;

		// Only allow digits
		if (val && !/^\d$/.test(val)) {
			input.value = digits[index];
			return;
		}

		const newDigits = [...digits];
		newDigits[index] = val;
		updateValue(newDigits);

		// Auto-focus next input
		if (val && index < 5) {
			inputs[index + 1]?.focus();
		}
	}

	function handleKeydown(index: number, event: KeyboardEvent) {
		// Backspace: clear current and move to previous
		if (event.key === 'Backspace' && !digits[index] && index > 0) {
			inputs[index - 1]?.focus();
		}

		// Arrow keys navigation
		if (event.key === 'ArrowLeft' && index > 0) {
			event.preventDefault();
			inputs[index - 1]?.focus();
		}
		if (event.key === 'ArrowRight' && index < 5) {
			event.preventDefault();
			inputs[index + 1]?.focus();
		}
	}

	function handlePaste(event: ClipboardEvent) {
		event.preventDefault();
		const pastedData = event.clipboardData?.getData('text') || '';
		const digitsOnly = pastedData.replace(/\D/g, '').slice(0, 6);

		if (digitsOnly.length > 0) {
			const newDigits = [...digits];
			for (let i = 0; i < 6; i++) {
				newDigits[i] = digitsOnly[i] || '';
			}
			updateValue(newDigits);

			// Focus last filled input or first empty
			const focusIndex = Math.min(digitsOnly.length, 5);
			inputs[focusIndex]?.focus();
		}
	}
</script>

<div class="space-y-2">
	<label for="otp-input-0" class="block text-sm font-medium">
		Enter 6-digit authentication code
	</label>

	<div class="flex gap-2" role="group" aria-labelledby="otp-label">
		{#each digits as digit, i (i)}
			<input
				bind:this={inputs[i]}
				id="otp-input-{i}"
				type="text"
				inputmode="numeric"
				maxlength="1"
				value={digit}
				{disabled}
				oninput={(e) => handleInput(i, e)}
				onkeydown={(e) => handleKeydown(i, e)}
				onpaste={i === 0 ? handlePaste : undefined}
				aria-label="Digit {i + 1}"
				aria-invalid={!!error}
				class="h-12 w-12 rounded-md border-2 {error
					? 'border-destructive'
					: 'border-gray-300 dark:border-gray-600'} bg-white text-center text-lg font-semibold text-gray-900 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:text-gray-100"
			/>
		{/each}
	</div>

	{#if error}
		<p class="text-sm text-destructive" role="alert">{error}</p>
	{/if}

	<p class="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>

	<!-- Hidden input for form submission -->
	<input type="hidden" name="code" {value} />
</div>
