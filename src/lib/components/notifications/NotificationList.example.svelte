<script lang="ts">
	import NotificationList from './NotificationList.svelte';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { QueryClientProvider, QueryClient } from '@tanstack/svelte-query';

	// Create a query client for the example
	const queryClient = new QueryClient();

	// Mock auth token (in real app, get from auth store/context)
	const authToken = 'your-auth-token-here';
</script>

<QueryClientProvider client={queryClient}>
	<div class="container mx-auto space-y-8 p-4">
		<div>
			<h1 class="mb-2 text-3xl font-bold">NotificationList Component Examples</h1>
			<p class="text-muted-foreground">
				Demonstrating different configurations of the NotificationList component
			</p>
		</div>

		<!-- Full mode example -->
		<section>
			<Card>
				<CardHeader>
					<CardTitle>Full Mode</CardTitle>
					<CardDescription>
						Complete notification list with filters, pagination, and bulk actions
					</CardDescription>
				</CardHeader>
				<CardContent>
					<NotificationList {authToken} />
				</CardContent>
			</Card>
		</section>

		<!-- Compact mode example -->
		<section>
			<Card>
				<CardHeader>
					<CardTitle>Compact Mode</CardTitle>
					<CardDescription>
						Simplified view for dropdowns and sidebars - shows max 5 items, no pagination
					</CardDescription>
				</CardHeader>
				<CardContent>
					<NotificationList {authToken} compact={true} maxItems={5} />
				</CardContent>
			</Card>
		</section>

		<!-- Compact mode with custom maxItems -->
		<section>
			<Card>
				<CardHeader>
					<CardTitle>Compact Mode - Custom Max Items</CardTitle>
					<CardDescription>Show only 3 most recent notifications</CardDescription>
				</CardHeader>
				<CardContent>
					<NotificationList {authToken} compact={true} maxItems={3} />
				</CardContent>
			</Card>
		</section>

		<!-- Usage in a dropdown -->
		<section>
			<Card>
				<CardHeader>
					<CardTitle>Dropdown Usage Example</CardTitle>
					<CardDescription>How to use NotificationList in a header dropdown</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="rounded-lg bg-muted/50 p-4">
						<code class="text-sm">
							<pre>{`<script>
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger
  } from '$lib/components/ui/dropdown-menu';
  import { Button } from '$lib/components/ui/button';
  import { Bell } from 'lucide-svelte';
  import NotificationList from '$lib/components/notifications/NotificationList.svelte';

  let authToken = $derived(/* get from auth store */);
<\/script>

<DropdownMenu>
  <DropdownMenuTrigger asChild let:builder>
    <Button builders={[builder]} variant="ghost" size="icon">
      <Bell class="h-5 w-5" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent class="w-[400px] max-w-[90vw]">
    <NotificationList {authToken} compact={true} maxItems={5} />
  </DropdownMenuContent>
</DropdownMenu>`}</pre>
						</code>
					</div>
				</CardContent>
			</Card>
		</section>

		<!-- Features overview -->
		<section>
			<Card>
				<CardHeader>
					<CardTitle>Features</CardTitle>
					<CardDescription>What the NotificationList component provides</CardDescription>
				</CardHeader>
				<CardContent>
					<ul class="space-y-2 text-sm">
						<li class="flex items-start gap-2">
							<span class="text-primary">✓</span>
							<span
								><strong>Filtering:</strong> Toggle between all notifications and unread only</span
							>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-primary">✓</span>
							<span
								><strong>Type Filtering:</strong> Filter by notification type (event, RSVP, invitation,
								etc.)</span
							>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-primary">✓</span>
							<span
								><strong>Bulk Actions:</strong> Mark all notifications as read with one click</span
							>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-primary">✓</span>
							<span
								><strong>Pagination:</strong> Navigate through multiple pages of notifications (full
								mode only)</span
							>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-primary">✓</span>
							<span><strong>Loading States:</strong> Skeleton loaders while fetching data</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-primary">✓</span>
							<span
								><strong>Empty States:</strong> Friendly messages when no notifications exist</span
							>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-primary">✓</span>
							<span><strong>Error Handling:</strong> Graceful error display with retry option</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-primary">✓</span>
							<span
								><strong>Accessibility:</strong> WCAG 2.1 AA compliant with keyboard navigation</span
							>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-primary">✓</span>
							<span><strong>Mobile-First:</strong> Responsive design for all screen sizes</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-primary">✓</span>
							<span><strong>Real-time Updates:</strong> Automatic refresh after status changes</span
							>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-primary">✓</span>
							<span><strong>Optimistic Updates:</strong> Instant feedback for user actions</span>
						</li>
					</ul>
				</CardContent>
			</Card>
		</section>

		<!-- Props documentation -->
		<section>
			<Card>
				<CardHeader>
					<CardTitle>Props</CardTitle>
					<CardDescription>Available props for customization</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b">
									<th class="py-2 pr-4 text-left">Prop</th>
									<th class="py-2 pr-4 text-left">Type</th>
									<th class="py-2 pr-4 text-left">Default</th>
									<th class="py-2 text-left">Description</th>
								</tr>
							</thead>
							<tbody>
								<tr class="border-b">
									<td class="py-2 pr-4"><code>authToken</code></td>
									<td class="py-2 pr-4"><code>string</code></td>
									<td class="py-2 pr-4">-</td>
									<td class="py-2">Required. JWT token for API authentication</td>
								</tr>
								<tr class="border-b">
									<td class="py-2 pr-4"><code>compact</code></td>
									<td class="py-2 pr-4"><code>boolean</code></td>
									<td class="py-2 pr-4"><code>false</code></td>
									<td class="py-2">Enable compact mode for dropdowns (no pagination, scrollable)</td
									>
								</tr>
								<tr class="border-b">
									<td class="py-2 pr-4"><code>maxItems</code></td>
									<td class="py-2 pr-4"><code>number</code></td>
									<td class="py-2 pr-4"><code>5</code></td>
									<td class="py-2">Maximum items to show in compact mode</td>
								</tr>
								<tr class="border-b">
									<td class="py-2 pr-4"><code>class</code></td>
									<td class="py-2 pr-4"><code>string</code></td>
									<td class="py-2 pr-4">-</td>
									<td class="py-2">Additional CSS classes for the container</td>
								</tr>
							</tbody>
						</table>
					</div>
				</CardContent>
			</Card>
		</section>
	</div>
</QueryClientProvider>
