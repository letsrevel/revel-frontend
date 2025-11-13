<script lang="ts">
	import NotificationDropdown from './NotificationDropdown.svelte';
	import { QueryClientProvider, QueryClient } from '@tanstack/svelte-query';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
		CardDescription
	} from '$lib/components/ui/card';

	// Mock auth token (in real app, this would come from auth store)
	const authToken = 'your-auth-token-here';

	// Create query client
	const queryClient = new QueryClient();
</script>

<QueryClientProvider client={queryClient}>
	<div class="min-h-screen bg-background p-4 md:p-8">
		<div class="container mx-auto max-w-6xl space-y-8">
			<!-- Header Section -->
			<div>
				<h1 class="text-3xl font-bold tracking-tight">NotificationDropdown Component</h1>
				<p class="mt-2 text-muted-foreground">
					A dropdown menu for displaying recent notifications in the header
				</p>
			</div>

			<!-- Example: Basic Usage -->
			<Card>
				<CardHeader>
					<CardTitle>Basic Usage</CardTitle>
					<CardDescription>Default notification dropdown with bell icon and badge</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
						<div>
							<h3 class="font-semibold">App Header Example</h3>
							<p class="text-sm text-muted-foreground">Click the bell icon to open notifications</p>
						</div>
						<div class="flex items-center gap-4">
							<NotificationDropdown {authToken} />
							<Button variant="ghost" size="icon">
								<span class="text-xl">👤</span>
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			<!-- Example: Custom Polling Interval -->
			<Card>
				<CardHeader>
					<CardTitle>Custom Polling Interval</CardTitle>
					<CardDescription>Update notification count every 30 seconds instead of 60</CardDescription
					>
				</CardHeader>
				<CardContent>
					<div class="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
						<div>
							<h3 class="font-semibold">Fast Polling (30s)</h3>
							<p class="text-sm text-muted-foreground">
								Checks for new notifications more frequently
							</p>
						</div>
						<div class="flex items-center gap-4">
							<NotificationDropdown {authToken} pollingInterval={30000} />
						</div>
					</div>
				</CardContent>
			</Card>

			<!-- Example: Custom Max Items -->
			<Card>
				<CardHeader>
					<CardTitle>Custom Max Items</CardTitle>
					<CardDescription
						>Show more notifications in the dropdown (10 instead of 5)</CardDescription
					>
				</CardHeader>
				<CardContent>
					<div class="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
						<div>
							<h3 class="font-semibold">Extended List</h3>
							<p class="text-sm text-muted-foreground">
								Displays up to 10 notifications before "View all"
							</p>
						</div>
						<div class="flex items-center gap-4">
							<NotificationDropdown {authToken} maxItems={10} />
						</div>
					</div>
				</CardContent>
			</Card>

			<!-- Example: In Navigation Header -->
			<Card>
				<CardHeader>
					<CardTitle>Full Header Example</CardTitle>
					<CardDescription>Complete navigation header with notification dropdown</CardDescription>
				</CardHeader>
				<CardContent>
					<header class="flex items-center justify-between rounded-lg border bg-card p-4">
						<!-- Logo -->
						<div class="flex items-center gap-2">
							<div
								class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground"
							>
								R
							</div>
							<span class="text-lg font-bold">Revel</span>
						</div>

						<!-- Navigation -->
						<nav class="hidden items-center gap-6 md:flex">
							<a href="/" class="text-sm font-medium hover:underline">Home</a>
							<a href="/events" class="text-sm font-medium hover:underline">Events</a>
							<a href="/organizations" class="text-sm font-medium hover:underline">Organizations</a>
						</nav>

						<!-- Right side actions -->
						<div class="flex items-center gap-2">
							<NotificationDropdown {authToken} />
							<Button variant="ghost" size="icon">
								<span class="text-xl">👤</span>
							</Button>
						</div>
					</header>
				</CardContent>
			</Card>

			<!-- Features List -->
			<Card>
				<CardHeader>
					<CardTitle>Features</CardTitle>
				</CardHeader>
				<CardContent>
					<ul class="space-y-2 text-sm">
						<li class="flex items-start gap-2">
							<span class="font-bold text-green-500">✓</span>
							<span
								><strong>Unread Badge:</strong> Shows count of unread notifications on bell icon</span
							>
						</li>
						<li class="flex items-start gap-2">
							<span class="font-bold text-green-500">✓</span>
							<span
								><strong>Compact List:</strong> Displays recent notifications in a scrollable dropdown</span
							>
						</li>
						<li class="flex items-start gap-2">
							<span class="font-bold text-green-500">✓</span>
							<span><strong>View All Link:</strong> Direct link to full notifications page</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="font-bold text-green-500">✓</span>
							<span
								><strong>Keyboard Accessible:</strong> Tab to focus, Enter to open, Escape to close</span
							>
						</li>
						<li class="flex items-start gap-2">
							<span class="font-bold text-green-500">✓</span>
							<span><strong>Mobile Responsive:</strong> Dropdown width adjusts to screen size</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="font-bold text-green-500">✓</span>
							<span
								><strong>Real-time Polling:</strong> Automatically checks for new notifications</span
							>
						</li>
						<li class="flex items-start gap-2">
							<span class="font-bold text-green-500">✓</span>
							<span
								><strong>Auto-close on Click:</strong> Navigates to notification detail and closes dropdown</span
							>
						</li>
					</ul>
				</CardContent>
			</Card>

			<!-- Props Documentation -->
			<Card>
				<CardHeader>
					<CardTitle>Props</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b">
									<th class="px-4 py-2 text-left font-semibold">Prop</th>
									<th class="px-4 py-2 text-left font-semibold">Type</th>
									<th class="px-4 py-2 text-left font-semibold">Default</th>
									<th class="px-4 py-2 text-left font-semibold">Description</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								<tr>
									<td class="px-4 py-2 font-mono text-xs">authToken</td>
									<td class="px-4 py-2 font-mono text-xs">string</td>
									<td class="px-4 py-2 font-mono text-xs">-</td>
									<td class="px-4 py-2">Required. JWT authentication token</td>
								</tr>
								<tr>
									<td class="px-4 py-2 font-mono text-xs">pollingInterval</td>
									<td class="px-4 py-2 font-mono text-xs">number</td>
									<td class="px-4 py-2 font-mono text-xs">60000</td>
									<td class="px-4 py-2">Polling interval in ms (for badge count)</td>
								</tr>
								<tr>
									<td class="px-4 py-2 font-mono text-xs">maxItems</td>
									<td class="px-4 py-2 font-mono text-xs">number</td>
									<td class="px-4 py-2 font-mono text-xs">5</td>
									<td class="px-4 py-2">Maximum notifications to show in dropdown</td>
								</tr>
								<tr>
									<td class="px-4 py-2 font-mono text-xs">class</td>
									<td class="px-4 py-2 font-mono text-xs">string</td>
									<td class="px-4 py-2 font-mono text-xs">undefined</td>
									<td class="px-4 py-2">Additional CSS classes</td>
								</tr>
							</tbody>
						</table>
					</div>
				</CardContent>
			</Card>

			<!-- Keyboard Navigation -->
			<Card>
				<CardHeader>
					<CardTitle>Keyboard Navigation</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="space-y-2 text-sm">
						<div class="flex items-center justify-between rounded bg-muted/50 p-2">
							<span class="rounded border bg-background px-2 py-1 font-mono text-xs">Tab</span>
							<span class="ml-4 flex-1">Focus the notification button</span>
						</div>
						<div class="flex items-center justify-between rounded bg-muted/50 p-2">
							<span class="rounded border bg-background px-2 py-1 font-mono text-xs">Enter</span>
							<span class="ml-4 flex-1">Open the dropdown menu</span>
						</div>
						<div class="flex items-center justify-between rounded bg-muted/50 p-2">
							<span class="rounded border bg-background px-2 py-1 font-mono text-xs">Escape</span>
							<span class="ml-4 flex-1">Close the dropdown menu</span>
						</div>
						<div class="flex items-center justify-between rounded bg-muted/50 p-2">
							<span class="rounded border bg-background px-2 py-1 font-mono text-xs"
								>Arrow Keys</span
							>
							<span class="ml-4 flex-1">Navigate through notifications</span>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	</div>
</QueryClientProvider>
