<script lang="ts">
	import ConfirmDialog from './ConfirmDialog.svelte';

	interface Props {
		onConfirm: () => void;
		onCancel: () => void;
	}

	const { onConfirm, onCancel }: Props = $props();

	let open = $state(false);
</script>

<button type="button" onclick={() => (open = true)}>Open</button>
<ConfirmDialog
	isOpen={open}
	title="Remove it?"
	message="This cannot be undone."
	confirmText="Remove"
	variant="danger"
	onConfirm={() => {
		open = false;
		onConfirm();
	}}
	onCancel={() => {
		open = false;
		onCancel();
	}}
/>
