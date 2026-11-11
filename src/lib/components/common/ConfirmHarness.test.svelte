<script lang="ts">
	import ConfirmDialog from './ConfirmDialog.svelte';
	import { createConfirm } from './confirm.svelte';

	interface Props {
		results: boolean[];
	}

	const { results }: Props = $props();

	const confirm = createConfirm();

	async function ask(message: string): Promise<void> {
		results.push(await confirm.ask({ message, confirmLabel: 'Do it', destructive: true }));
	}
</script>

<button type="button" onclick={() => ask('first')}>Ask first</button>
<button type="button" onclick={() => ask('second')}>Ask second</button>
<ConfirmDialog {...confirm.dialogProps} />
