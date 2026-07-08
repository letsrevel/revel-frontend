<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Shield, Ticket, Heart, ArrowRight, Users, Server, Lock } from '@lucide/svelte';

	interface Props {
		/**
		 * Locale-prefixed landing-path prefix (empty for `en`, `/de` or `/it` otherwise).
		 * Landing pages are NOT paraglide-translated; they use `/de/` and `/it/` prefixes.
		 */
		landingPagePrefix: string;
	}
	const { landingPagePrefix }: Props = $props();
</script>

<!-- Use Cases Section -->
<div class="mb-16 mt-8">
	<div class="text-center">
		<h2 class="mb-4 text-3xl font-bold">{m['home.useCasesTitle']()}</h2>
		<p class="mx-auto mb-8 max-w-2xl text-muted-foreground">
			{m['home.useCasesDescription']()}
		</p>
	</div>
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		<!-- eslint-disable svelte/no-navigation-without-resolve -- locale-prefixed landing path; the prefix comes from getLocale() and cannot map to a single static route id -->
		<a
			href="{landingPagePrefix}/queer-event-management"
			class="group rounded-lg border bg-card p-6 transition-all hover:border-primary hover:shadow-md"
		>
			<div class="mb-3 flex items-center gap-3">
				<div class="rounded-full bg-pink-100 p-2 dark:bg-pink-900/30">
					<Heart class="h-5 w-5 text-pink-600 dark:text-pink-400" aria-hidden="true" />
				</div>
				<h3 class="font-semibold">{m['footer.solutionQueer']()}</h3>
			</div>
			<p class="mb-3 text-sm text-muted-foreground">
				{m['home.useCaseQueerDescription']()}
			</p>
			<span
				class="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:underline"
			>
				{m['footer.learnMore']()}
				<ArrowRight class="h-4 w-4" aria-hidden="true" />
			</span>
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->

		<!-- eslint-disable svelte/no-navigation-without-resolve -- locale-prefixed landing path; the prefix comes from getLocale() and cannot map to a single static route id -->
		<a
			href="{landingPagePrefix}/kink-event-ticketing"
			class="group rounded-lg border bg-card p-6 transition-all hover:border-primary hover:shadow-md"
		>
			<div class="mb-3 flex items-center gap-3">
				<div class="rounded-full bg-purple-100 p-2 dark:bg-purple-900/30">
					<Shield class="h-5 w-5 text-purple-600 dark:text-purple-400" aria-hidden="true" />
				</div>
				<h3 class="font-semibold">{m['footer.solutionKink']()}</h3>
			</div>
			<p class="mb-3 text-sm text-muted-foreground">
				{m['home.useCaseKinkDescription']()}
			</p>
			<span
				class="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:underline"
			>
				{m['footer.learnMore']()}
				<ArrowRight class="h-4 w-4" aria-hidden="true" />
			</span>
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->

		<!-- eslint-disable svelte/no-navigation-without-resolve -- locale-prefixed landing path; the prefix comes from getLocale() and cannot map to a single static route id -->
		<a
			href="{landingPagePrefix}/privacy-focused-events"
			class="group rounded-lg border bg-card p-6 transition-all hover:border-primary hover:shadow-md"
		>
			<div class="mb-3 flex items-center gap-3">
				<div class="rounded-full bg-green-100 p-2 dark:bg-green-900/30">
					<Lock class="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
				</div>
				<h3 class="font-semibold">{m['footer.solutionPrivacy']()}</h3>
			</div>
			<p class="mb-3 text-sm text-muted-foreground">
				{m['home.useCasePrivacyDescription']()}
			</p>
			<span
				class="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:underline"
			>
				{m['footer.learnMore']()}
				<ArrowRight class="h-4 w-4" aria-hidden="true" />
			</span>
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->

		<!-- eslint-disable svelte/no-navigation-without-resolve -- locale-prefixed landing path; the prefix comes from getLocale() and cannot map to a single static route id -->
		<a
			href="{landingPagePrefix}/self-hosted-event-platform"
			class="group rounded-lg border bg-card p-6 transition-all hover:border-primary hover:shadow-md"
		>
			<div class="mb-3 flex items-center gap-3">
				<div class="rounded-full bg-blue-100 p-2 dark:bg-blue-900/30">
					<Server class="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
				</div>
				<h3 class="font-semibold">{m['footer.solutionSelfHosted']()}</h3>
			</div>
			<p class="mb-3 text-sm text-muted-foreground">
				{m['home.useCaseSelfHostedDescription']()}
			</p>
			<span
				class="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:underline"
			>
				{m['footer.learnMore']()}
				<ArrowRight class="h-4 w-4" aria-hidden="true" />
			</span>
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->

		<!-- eslint-disable svelte/no-navigation-without-resolve -- locale-prefixed landing path; the prefix comes from getLocale() and cannot map to a single static route id -->
		<a
			href="{landingPagePrefix}/eventbrite-alternative"
			class="group rounded-lg border bg-card p-6 transition-all hover:border-primary hover:shadow-md"
		>
			<div class="mb-3 flex items-center gap-3">
				<div class="rounded-full bg-orange-100 p-2 dark:bg-orange-900/30">
					<Ticket class="h-5 w-5 text-orange-600 dark:text-orange-400" aria-hidden="true" />
				</div>
				<h3 class="font-semibold">{m['footer.solutionEventbrite']()}</h3>
			</div>
			<p class="mb-3 text-sm text-muted-foreground">
				{m['home.useCaseEventbriteDescription']()}
			</p>
			<span
				class="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:underline"
			>
				{m['footer.learnMore']()}
				<ArrowRight class="h-4 w-4" aria-hidden="true" />
			</span>
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->

		<!-- eslint-disable svelte/no-navigation-without-resolve -- locale-prefixed landing path; the prefix comes from getLocale() and cannot map to a single static route id -->
		<a
			href="{landingPagePrefix}/community-first-event-platform"
			class="group rounded-lg border bg-card p-6 transition-all hover:border-primary hover:shadow-md"
		>
			<div class="mb-3 flex items-center gap-3">
				<div class="rounded-full bg-teal-100 p-2 dark:bg-teal-900/30">
					<Users class="h-5 w-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
				</div>
				<h3 class="font-semibold">{m['footer.solutionCommunity']()}</h3>
			</div>
			<p class="mb-3 text-sm text-muted-foreground">
				{m['home.useCaseCommunityDescription']()}
			</p>
			<span
				class="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:underline"
			>
				{m['footer.learnMore']()}
				<ArrowRight class="h-4 w-4" aria-hidden="true" />
			</span>
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</div>
</div>
