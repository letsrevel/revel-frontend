<script lang="ts">
	import { cn } from '$lib/utils/cn';

	/**
	 * DateTimePicker Component
	 *
	 * A mobile-friendly datetime picker using native HTML5 input.
	 * Supports validation, min/max constraints, and accessibility.
	 *
	 * @example
	 * ```svelte
	 * <DateTimePicker
	 *   bind:value={eventStartTime}
	 *   label="Event Start Time"
	 *   required
	 *   min={new Date().toISOString()}
	 *   error={errors.startTime}
	 * />
	 * ```
	 */
	interface Props {
		/** ISO 8601 datetime string (YYYY-MM-DDTHH:mm) */
		value?: string;
		/** Unique identifier for the input */
		id?: string;
		/** Label text displayed above the input */
		label?: string;
		/** Placeholder text */
		placeholder?: string;
		/** Whether the field is required */
		required?: boolean;
		/** Whether the field is disabled */
		disabled?: boolean;
		/** Minimum allowed datetime (ISO 8601) */
		min?: string;
		/** Maximum allowed datetime (ISO 8601) */
		max?: string;
		/** Error message to display */
		error?: string;
		/** Additional CSS classes */
		class?: string;
		/** Callback fired when value changes */
		onValueChange?: (value: string) => void;
	}

	let {
		value = $bindable(''),
		id,
		label,
		placeholder,
		required = false,
		disabled = false,
		min,
		max,
		error,
		class: className,
		onValueChange
	}: Props = $props();

	// Generate unique ID if not provided
	const inputId = $derived(id || `datetime-${Math.random().toString(36).substr(2, 9)}`);

	// Convert ISO 8601 to datetime-local format (YYYY-MM-DDTHH:mm)
	function toDatetimeLocalFormat(isoString: string | undefined): string {
		if (!isoString) return '';
		try {
			// Remove seconds and milliseconds if present
			return isoString.slice(0, 16);
		} catch {
			return '';
		}
	}

	// Local value for the input (datetime-local format)
	let localValue = $state(toDatetimeLocalFormat(value));

	// Sync local value with prop value
	$effect(() => {
		const formatted = toDatetimeLocalFormat(value);
		if (formatted !== localValue) {
			localValue = formatted;
		}
	});

	function handleInput(event: Event): void {
		const target = event.target as HTMLInputElement;
		const newValue = target.value;
		localValue = newValue;

		// Convert to ISO 8601 format for the parent component
		const isoValue = newValue ? `${newValue}:00` : '';
		value = isoValue;
		onValueChange?.(isoValue);
	}
</script>

<div class={cn('space-y-2', className)}>
	{#if label}
		<label for={inputId} class="block text-sm font-medium text-gray-900 dark:text-gray-100">
			{label}
			{#if required}
				<span class="text-destructive" aria-label="required">*</span>
			{/if}
		</label>
	{/if}

	<input
		type="datetime-local"
		{id}
		name={inputId}
		bind:value={localValue}
		oninput={handleInput}
		{placeholder}
		{required}
		{disabled}
		min={toDatetimeLocalFormat(min)}
		max={toDatetimeLocalFormat(max)}
		aria-invalid={!!error}
		aria-describedby={error ? `${inputId}-error` : undefined}
		class={cn(
			'flex h-10 w-full rounded-md border-2 px-3 py-2 text-sm transition-colors',
			'bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100',
			'placeholder:text-muted-foreground',
			'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
			'disabled:cursor-not-allowed disabled:opacity-50',
			error
				? 'border-destructive focus:border-destructive focus:ring-destructive'
				: 'border-gray-300 dark:border-gray-600'
		)}
	/>

	{#if error}
		<p id="{inputId}-error" class="text-sm text-destructive" role="alert">
			{error}
		</p>
	{/if}
</div>
