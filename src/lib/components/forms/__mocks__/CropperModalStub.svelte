<script lang="ts">
	const { onSave, onCancel }: { onSave: (b: Blob) => void; onCancel: () => void } = $props();
</script>

<div data-testid="cropper-modal-stub">
	<button
		type="button"
		data-testid="cropper-save"
		onclick={() => onSave(new Blob(['x'], { type: 'image/jpeg' }))}>save</button
	>
	<button type="button" data-testid="cropper-cancel" onclick={onCancel}>cancel</button>
</div>
