<script lang="ts">
	const {
		oncropcomplete
	}: { oncropcomplete?: (e: { percent: unknown; pixels: unknown }) => void } = $props();
	// Emit a deterministic crop rectangle once mounted.
	$effect(() => {
		oncropcomplete?.({
			percent: { x: 0, y: 0, width: 100, height: 100 },
			pixels: { x: 0, y: 0, width: 100, height: 100 }
		});
	});
</script>

<div data-testid="cropper-stub"></div>
