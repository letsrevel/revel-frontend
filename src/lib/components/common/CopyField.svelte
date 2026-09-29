<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Check, Copy } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';

	interface Props {
		value: string;
		/** Already-translated; names the input and the button ("Copy {label}"). */
		label: string;
		id?: string;
		mono?: boolean;
		class?: string;
	}
	const { value, label, id, mono = true, class: className = '' }: Props = $props();

	const inputId = $derived(id ?? `copy-${label.replace(/\W+/g, '-').toLowerCase()}`);
	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			copied = true;
			clearTimeout(timer);
			timer = setTimeout(() => (copied = false), 2000);
			toast.success(m['common.copied']());
		} catch {
			toast.error(m['common.copyFailed']());
		}
	}
</script>

<div class={cn('flex flex-col gap-2 sm:flex-row', className)}>
	<Input
		id={inputId}
		type="text"
		readonly
		{value}
		aria-label={label}
		class={cn('text-xs', mono && 'font-mono')}
		onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
	/>
	<Button type="button" variant="outline" size="sm" onclick={copy} class="shrink-0 gap-2">
		{#if copied}
			<Check class="h-4 w-4" aria-hidden="true" />
		{:else}
			<Copy class="h-4 w-4" aria-hidden="true" />
		{/if}
		<span class="sr-only">{m['common.copyNamed']({ label })}</span>
		<span aria-hidden="true">{m['common.copy']()}</span>
	</Button>
</div>
