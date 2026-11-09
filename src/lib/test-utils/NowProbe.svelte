<script lang="ts">
	import { useNow } from '$lib/member-register/now.svelte';

	// Test-only: renders the reactive clock so a test can watch it tick.
	const clock = useNow(1000);
</script>

<p data-testid="now">{clock.current.toISOString()}</p>
