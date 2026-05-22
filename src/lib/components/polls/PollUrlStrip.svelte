<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Copy } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		url: string;
		/** When true, the Copy button is disabled (e.g. for DRAFT polls). */
		disabled?: boolean;
	}
	const { url, disabled = false }: Props = $props();

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(url);
			toast.success(m['pollCard.copySuccess']());
		} catch (err) {
			console.error('clipboard write failed', err);
			toast.error(m['pollCard.copyError']());
		}
	}
</script>

<div class="flex flex-col gap-2 sm:flex-row">
	<Input
		type="text"
		readonly
		value={url}
		aria-label="Poll share URL"
		class="font-mono text-xs"
	/>
	<Button
		type="button"
		variant="default"
		size="sm"
		onclick={handleCopy}
		{disabled}
		class="gap-2 shrink-0"
	>
		<Copy class="h-4 w-4" aria-hidden="true" />
		{m['pollCard.copyLink']()}
	</Button>
</div>
