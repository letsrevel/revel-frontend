<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
</script>

<!-- Unreachable: the server load always redirects. Kept minimal on purpose. -->
<div class="container mx-auto max-w-md px-4 py-16 text-center">
	<a href={resolve('/(public)/login', {})} class="text-primary underline-offset-4 hover:underline">
		{m['login.oidcCallbackFallbackLink']()}
	</a>
</div>
