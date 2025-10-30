<script lang="ts">
	import { PUBLIC_VERSION } from '$env/static/public';
	import { appStore } from '$lib/stores/app.svelte';
	import { Github, Bug } from 'lucide-svelte';

	// Frontend version from build-time environment variable (set in Dockerfile)
	// Falls back to 'dev' for local development
	// Remove leading 'v' if present since we add it in the template
	const FRONTEND_VERSION = PUBLIC_VERSION ? PUBLIC_VERSION.replace(/^v/, '') : 'dev';
	const FRONTEND_REPO = 'https://github.com/letsrevel/revel-frontend';
	const BACKEND_REPO = 'https://github.com/letsrevel/revel-backend';

	// Get backend version and demo mode from store
	let backendVersion = $derived(appStore.backendVersion || 'Loading...');
	let isDemoMode = $derived(appStore.isDemoMode);
</script>

<footer class="border-t bg-muted/30">
	<div class="container mx-auto px-4 py-8 md:py-12">
		<div class="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
			<!-- About Section -->
			<div>
				<h3 class="mb-4 text-lg font-semibold">Revel</h3>
				<p class="mb-4 text-sm text-muted-foreground">
					Open-source, community-focused event management and ticketing platform.
				</p>
				<ul class="space-y-2 text-sm">
					<li>
						<a
							href="https://forms.gle/7wAqQXqrWk3X6Ddu7"
							target="_blank"
							rel="noopener noreferrer"
							class="text-muted-foreground transition-colors hover:text-foreground"
						>
							Send Feedback
						</a>
					</li>
				</ul>
			</div>

			<!-- Legal Links -->
			<div>
				<h3 class="mb-4 text-lg font-semibold">Legal</h3>
				<ul class="space-y-2 text-sm">
					<li>
						<a
							href="/legal/privacy"
							class="text-muted-foreground transition-colors hover:text-foreground"
						>
							Privacy Policy
						</a>
					</li>
					<li>
						<a
							href="/legal/terms"
							class="text-muted-foreground transition-colors hover:text-foreground"
						>
							Terms of Service
						</a>
					</li>
					<li>
						<a
							href="/contact"
							class="text-muted-foreground transition-colors hover:text-foreground"
						>
							Contact
						</a>
					</li>
				</ul>
			</div>

			<!-- Resources -->
			<div>
				<h3 class="mb-4 text-lg font-semibold">Resources</h3>
				<ul class="space-y-2 text-sm">
					<li>
						<a href="/events" class="text-muted-foreground transition-colors hover:text-foreground">
							Browse Events
						</a>
					</li>
					<li>
						<a
							href="/organizations"
							class="text-muted-foreground transition-colors hover:text-foreground"
						>
							Organizations
						</a>
					</li>
					<li>
						<a
							href="https://github.com/letsrevel"
							target="_blank"
							rel="noopener noreferrer"
							class="text-muted-foreground transition-colors hover:text-foreground"
						>
							GitHub
						</a>
					</li>
				</ul>
			</div>

			<!-- Version Info -->
			<div>
				<h3 class="mb-4 text-lg font-semibold">Version Info</h3>
				<ul class="space-y-2 text-sm text-muted-foreground">
					<li class="flex items-center gap-2">
						<a
							href={FRONTEND_REPO}
							target="_blank"
							rel="noopener noreferrer"
							class="flex items-center gap-2 transition-colors hover:text-foreground"
							aria-label="Frontend repository on GitHub"
						>
							<Github class="h-4 w-4" aria-hidden="true" />
							<span>Frontend: v{FRONTEND_VERSION}</span>
						</a>
					</li>
					<li class="flex items-center gap-2">
						<a
							href={BACKEND_REPO}
							target="_blank"
							rel="noopener noreferrer"
							class="flex items-center gap-2 transition-colors hover:text-foreground"
							aria-label="Backend repository on GitHub"
						>
							<Github class="h-4 w-4" aria-hidden="true" />
							<span>Backend: v{backendVersion}{isDemoMode ? ' (demo)' : ''}</span>
						</a>
					</li>
					<li class="flex items-center gap-2">
						<a
							href="https://forms.gle/c6ovKV92nMQEbR877"
							target="_blank"
							rel="noopener noreferrer"
							class="flex items-center gap-2 transition-colors hover:text-foreground"
							aria-label="Report a bug"
						>
							<Bug class="h-4 w-4" aria-hidden="true" />
							<span>Report a bug</span>
						</a>
					</li>
				</ul>
			</div>
		</div>

		<!-- Copyright -->
		<div class="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
			<p>&copy; {new Date().getFullYear()} Revel. Open source and community-driven.</p>
		</div>
	</div>
</footer>
