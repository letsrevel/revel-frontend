<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<!-- Unreachable: the server load always redirects. Kept minimal on purpose. -->
<div class="container mx-auto max-w-md px-4 py-16 text-center">
	<a href={resolve('/(public)/login', {})} class="text-primary underline-offset-4 hover:underline">
		<!-- TODO(task 5): swap for m['login.oidcCallbackFallbackLink']() once the key lands -->
		Back to sign in
	</a>
</div>
