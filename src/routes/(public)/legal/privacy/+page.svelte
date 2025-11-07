<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	// Privacy Policy page (placeholder until backend endpoint is ready)
</script>

<div class="container mx-auto px-4 py-8">
	<h1 class="mb-8 text-3xl font-bold">{m['privacyPolicyPage.privacyPolicy']()}</h1>

	<div class="prose prose-slate dark:prose-invert max-w-none">
		<p class="text-muted-foreground">
			Privacy Policy content will be loaded from the backend at <code>/api/legal/privacy</code> once
			implemented.
		</p>
	</div>
</div>
