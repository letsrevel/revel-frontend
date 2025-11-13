<script lang="ts">
	/**
	 * NotificationBadge Usage Examples
	 *
	 * This file demonstrates various ways to use the NotificationBadge component.
	 * Copy the relevant example to your own component.
	 */

	import NotificationBadge from './NotificationBadge.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Bell } from 'lucide-svelte';

	// Mock auth token - in real app, get from user store or locals
	const authToken = 'your-auth-token-here';

	// Track count changes
	let currentCount = $state(0);

	function handleCountChange(count: number): void {
		console.log('Notification count changed:', count);
		currentCount = count;

		// Optionally show a browser notification
		if (count > currentCount && Notification.permission === 'granted') {
			new Notification('New Notification', {
				body: `You have ${count} unread notifications`,
				icon: '/notification-icon.png'
			});
		}
	}
</script>

<div class="space-y-8 p-8">
	<h1 class="text-2xl font-bold">NotificationBadge Examples</h1>

	<!-- Example 1: Basic usage with bell icon -->
	<section class="space-y-2">
		<h2 class="text-lg font-semibold">1. Basic Usage (Default)</h2>
		<p class="text-sm text-muted-foreground">
			Badge appears on notification bell, polls every 60 seconds
		</p>
		<Button variant="ghost" size="icon" class="relative">
			<Bell class="h-5 w-5" />
			<NotificationBadge {authToken} />
		</Button>
	</section>

	<!-- Example 2: Custom polling interval -->
	<section class="space-y-2">
		<h2 class="text-lg font-semibold">2. Custom Polling Interval</h2>
		<p class="text-sm text-muted-foreground">Poll every 30 seconds (30000ms)</p>
		<Button variant="ghost" size="icon" class="relative">
			<Bell class="h-5 w-5" />
			<NotificationBadge {authToken} pollingInterval={30000} />
		</Button>
	</section>

	<!-- Example 3: Show zero count -->
	<section class="space-y-2">
		<h2 class="text-lg font-semibold">3. Show Zero Count</h2>
		<p class="text-sm text-muted-foreground">Display badge even when count is 0</p>
		<Button variant="ghost" size="icon" class="relative">
			<Bell class="h-5 w-5" />
			<NotificationBadge {authToken} showZero={true} />
		</Button>
	</section>

	<!-- Example 4: Custom max count -->
	<section class="space-y-2">
		<h2 class="text-lg font-semibold">4. Custom Max Count</h2>
		<p class="text-sm text-muted-foreground">Show "9+" when count exceeds 9</p>
		<Button variant="ghost" size="icon" class="relative">
			<Bell class="h-5 w-5" />
			<NotificationBadge {authToken} maxCount={9} />
		</Button>
	</section>

	<!-- Example 5: With count change callback -->
	<section class="space-y-2">
		<h2 class="text-lg font-semibold">5. With Count Change Callback</h2>
		<p class="text-sm text-muted-foreground">
			Track count changes (current: {currentCount})
		</p>
		<Button variant="ghost" size="icon" class="relative">
			<Bell class="h-5 w-5" />
			<NotificationBadge {authToken} onCountChange={handleCountChange} />
		</Button>
	</section>

	<!-- Example 6: Custom styling -->
	<section class="space-y-2">
		<h2 class="text-lg font-semibold">6. Custom Styling</h2>
		<p class="text-sm text-muted-foreground">Custom colors and positioning</p>
		<Button variant="ghost" size="icon" class="relative">
			<Bell class="h-5 w-5" />
			<NotificationBadge
				{authToken}
				class="-right-2 -top-2 h-6 w-6 bg-blue-500 text-xs text-white"
			/>
		</Button>
	</section>

	<!-- Example 7: In navigation header -->
	<section class="space-y-2">
		<h2 class="text-lg font-semibold">7. In Navigation Header</h2>
		<p class="text-sm text-muted-foreground">Typical usage in app header/navbar</p>
		<nav class="flex items-center justify-between rounded-lg border p-4">
			<span class="font-semibold">My App</span>
			<div class="flex items-center gap-4">
				<a href="/notifications" class="relative">
					<Button variant="ghost" size="icon">
						<Bell class="h-5 w-5" />
						<NotificationBadge {authToken} />
					</Button>
				</a>
				<Button variant="outline" size="sm">Profile</Button>
			</div>
		</nav>
	</section>

	<!-- Example 8: Multiple badges for different notification types -->
	<section class="space-y-2">
		<h2 class="text-lg font-semibold">8. Multiple Notification Types</h2>
		<p class="text-sm text-muted-foreground">
			Different badges for messages, alerts, and notifications
		</p>
		<div class="flex gap-4">
			<div class="relative">
				<Button variant="ghost" size="icon">
					<Bell class="h-5 w-5" />
				</Button>
				<NotificationBadge {authToken} class="-right-1 -top-1" />
			</div>
			<div class="relative">
				<Button variant="ghost" size="icon">
					<Bell class="h-5 w-5" />
				</Button>
				<NotificationBadge {authToken} class="-right-1 -top-1 bg-orange-500" />
			</div>
			<div class="relative">
				<Button variant="ghost" size="icon">
					<Bell class="h-5 w-5" />
				</Button>
				<NotificationBadge {authToken} class="-right-1 -top-1 bg-green-500" />
			</div>
		</div>
	</section>

	<!-- Code Examples -->
	<section class="space-y-4 border-t pt-8">
		<h2 class="text-xl font-bold">Code Examples</h2>

		<div class="space-y-2">
			<h3 class="text-sm font-semibold">Basic Usage:</h3>
			<pre class="overflow-x-auto rounded-lg bg-muted p-4 text-xs"><code
					>{`<Button variant="ghost" size="icon" class="relative">
  <Bell class="h-5 w-5" />
  <NotificationBadge {authToken} />
</Button>`}</code
				></pre>
		</div>

		<div class="space-y-2">
			<h3 class="text-sm font-semibold">With All Props:</h3>
			<pre class="overflow-x-auto rounded-lg bg-muted p-4 text-xs"><code
					>{`<NotificationBadge
  {authToken}
  pollingInterval={30000}
  onCountChange={handleCountChange}
  showZero={false}
  maxCount={99}
  class="custom-styles"
/>`}</code
				></pre>
		</div>
	</section>
</div>
