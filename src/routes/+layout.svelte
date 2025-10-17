<script lang="ts">
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';

	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 60 * 1000 // 1 minute
			}
		}
	});
</script>

<ModeWatcher />
<QueryClientProvider client={queryClient}>
	<slot />
</QueryClientProvider>
