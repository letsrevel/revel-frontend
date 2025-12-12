<script lang="ts">
	import { PUBLIC_VERSION } from '$env/static/public';
	import { appStore } from '$lib/stores/app.svelte';
	import { Github, Bug } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';

	// Frontend version from build-time environment variable (set in Dockerfile)
	// Falls back to 'dev' for local development
	// Remove leading 'v' if present since we add it in the template
	const FRONTEND_VERSION = PUBLIC_VERSION ? PUBLIC_VERSION.replace(/^v/, '') : 'dev';
	const FRONTEND_REPO = 'https://github.com/letsrevel/revel-frontend';
	const BACKEND_REPO = 'https://github.com/letsrevel/revel-backend';

	// Get backend version and demo mode from store
	let backendVersion = $derived(appStore.backendVersion || 'Loading...');
	let isDemoMode = $derived(appStore.isDemoMode);

	// Landing page URLs based on current locale
	// Landing pages are NOT paraglide-translated, they use /de/ and /it/ prefixes
	let landingPagePrefix = $derived(getLocale() === 'en' ? '' : `/${getLocale()}`);
</script>

<footer class="border-t bg-muted/30">
	<div class="container mx-auto px-4 py-8 md:py-12">
		<div class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
			<!-- About Section -->
			<div>
				<h3 class="mb-4 text-lg font-semibold">{m['footer.aboutTitle']()}</h3>
				<p class="mb-4 text-sm text-muted-foreground">
					{m['footer.aboutDescription']()}
				</p>
				<ul class="space-y-2 text-sm">
					<li>
						<a
							href="https://forms.gle/7wAqQXqrWk3X6Ddu7"
							target="_blank"
							rel="noopener noreferrer"
							class="text-muted-foreground transition-colors hover:text-foreground"
						>
							{m['footer.sendFeedback']()}
						</a>
					</li>
				</ul>
			</div>

			<!-- Legal Links -->
			<div>
				<h3 class="mb-4 text-lg font-semibold">{m['footer.legalTitle']()}</h3>
				<ul class="space-y-2 text-sm">
					<li>
						<a
							href="/legal/privacy"
							class="text-muted-foreground transition-colors hover:text-foreground"
						>
							{m['footer.privacyPolicy']()}
						</a>
					</li>
					<li>
						<a
							href="/legal/terms"
							class="text-muted-foreground transition-colors hover:text-foreground"
						>
							{m['footer.termsOfService']()}
						</a>
					</li>
					<li>
						<a
							href="mailto:contact@letsrevel.io"
							class="text-muted-foreground transition-colors hover:text-foreground"
						>
							{m['footer.contact']()}
						</a>
					</li>
				</ul>
			</div>

			<!-- Resources -->
			<div>
				<h3 class="mb-4 text-lg font-semibold">{m['footer.resourcesTitle']()}</h3>
				<ul class="space-y-2 text-sm">
					<li>
						<a href="/events" class="text-muted-foreground transition-colors hover:text-foreground">
							{m['nav.browseEvents']()}
						</a>
					</li>
					<li>
						<a
							href="/organizations"
							class="text-muted-foreground transition-colors hover:text-foreground"
						>
							{m['nav.organizations']()}
						</a>
					</li>
					<li>
						<a
							href="https://github.com/letsrevel"
							target="_blank"
							rel="noopener noreferrer"
							class="text-muted-foreground transition-colors hover:text-foreground"
						>
							{m['footer.github']()}
						</a>
					</li>
				</ul>
			</div>

			<!-- Solutions / Use Cases -->
			<div>
				<h3 class="mb-4 text-lg font-semibold">{m['footer.solutionsTitle']()}</h3>
				<ul class="space-y-2 text-sm">
					<li>
						<a
							href="{landingPagePrefix}/eventbrite-alternative"
							class="text-muted-foreground transition-colors hover:text-foreground"
						>
							{m['footer.solutionEventbrite']()}
						</a>
					</li>
					<li>
						<a
							href="{landingPagePrefix}/queer-event-management"
							class="text-muted-foreground transition-colors hover:text-foreground"
						>
							{m['footer.solutionQueer']()}
						</a>
					</li>
					<li>
						<a
							href="{landingPagePrefix}/kink-event-ticketing"
							class="text-muted-foreground transition-colors hover:text-foreground"
						>
							{m['footer.solutionKink']()}
						</a>
					</li>
					<li>
						<a
							href="{landingPagePrefix}/self-hosted-event-platform"
							class="text-muted-foreground transition-colors hover:text-foreground"
						>
							{m['footer.solutionSelfHosted']()}
						</a>
					</li>
					<li>
						<a
							href="{landingPagePrefix}/privacy-focused-events"
							class="text-muted-foreground transition-colors hover:text-foreground"
						>
							{m['footer.solutionPrivacy']()}
						</a>
					</li>
					<li>
						<a
							href="{landingPagePrefix}/community-first-event-platform"
							class="text-muted-foreground transition-colors hover:text-foreground"
						>
							{m['footer.solutionCommunity']()}
						</a>
					</li>
				</ul>
			</div>

			<!-- Version Info -->
			<div>
				<h3 class="mb-4 text-lg font-semibold">{m['footer.versionInfoTitle']()}</h3>
				<ul class="space-y-2 text-sm text-muted-foreground">
					<li class="flex items-center gap-2">
						<a
							href={FRONTEND_REPO}
							target="_blank"
							rel="noopener noreferrer"
							class="flex items-center gap-2 transition-colors hover:text-foreground"
							aria-label="{m['footer.frontend']()} repository on GitHub"
						>
							<Github class="h-4 w-4" aria-hidden="true" />
							<span>{m['footer.frontend']()}: v{FRONTEND_VERSION}</span>
						</a>
					</li>
					<li class="flex items-center gap-2">
						<a
							href={BACKEND_REPO}
							target="_blank"
							rel="noopener noreferrer"
							class="flex items-center gap-2 transition-colors hover:text-foreground"
							aria-label="{m['footer.backend']()} repository on GitHub"
						>
							<Github class="h-4 w-4" aria-hidden="true" />
							<span>{m['footer.backend']()}: v{backendVersion}{isDemoMode ? ' (demo)' : ''}</span>
						</a>
					</li>
					<li class="flex items-center gap-2">
						<a
							href="https://forms.gle/c6ovKV92nMQEbR877"
							target="_blank"
							rel="noopener noreferrer"
							class="flex items-center gap-2 transition-colors hover:text-foreground"
							aria-label={m['footer.reportBug']()}
						>
							<Bug class="h-4 w-4" aria-hidden="true" />
							<span>{m['footer.reportBug']()}</span>
						</a>
					</li>
				</ul>
			</div>
		</div>

		<!-- Cookie Notice -->
		<div class="mt-8 border-t pt-8">
			<div class="rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">
				<p>
					{m['footer.cookieNotice']()}
				</p>
			</div>
		</div>

		<!-- Copyright -->
		<div class="mt-6 text-center text-sm text-muted-foreground">
			<p>&copy; {new Date().getFullYear()} Revel. {m['footer.copyright']()}</p>
		</div>
	</div>
</footer>
