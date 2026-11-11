<script lang="ts">
	import { probeMounts } from './mount-probe';

	const props: Record<string, unknown> = $props();
	probeMounts.push({ ...props });
</script>
