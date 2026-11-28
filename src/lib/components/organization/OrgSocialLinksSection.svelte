<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Send, AtSign } from '@lucide/svelte';
	import Instagram from '$lib/components/icons/brand/Instagram.svelte';
	import Facebook from '$lib/components/icons/brand/Facebook.svelte';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';

	interface Props {
		instagramUrl: string;
		facebookUrl: string;
		blueskyUrl: string;
		telegramUrl: string;
		/** Whether the Telegram field is shown (platform feature flag). */
		telegramEnabled: boolean;
	}

	let {
		instagramUrl = $bindable(),
		facebookUrl = $bindable(),
		blueskyUrl = $bindable(),
		telegramUrl = $bindable(),
		telegramEnabled
	}: Props = $props();
</script>

<section class="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
	<SectionHeader
		title={m['orgAdmin.settings.social.heading']()}
		subtitle={m['orgAdmin.settings.social.description']()}
	/>

	<div class="grid gap-4 md:grid-cols-2">
		<!-- Instagram -->
		<div>
			<label for="instagram_url" class="flex items-center gap-2 text-sm font-medium">
				<Instagram class="h-4 w-4 text-[hsl(var(--brand-instagram))]" aria-hidden="true" />
				Instagram
			</label>
			<input
				type="url"
				id="instagram_url"
				name="instagram_url"
				bind:value={instagramUrl}
				placeholder="https://instagram.com/yourorg"
				class="mt-1 flex w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
			/>
		</div>

		<!-- Facebook -->
		<div>
			<label for="facebook_url" class="flex items-center gap-2 text-sm font-medium">
				<Facebook class="h-4 w-4 text-[hsl(var(--brand-facebook))]" aria-hidden="true" />
				Facebook
			</label>
			<input
				type="url"
				id="facebook_url"
				name="facebook_url"
				bind:value={facebookUrl}
				placeholder="https://facebook.com/yourorg"
				class="mt-1 flex w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
			/>
		</div>

		<!-- Bluesky -->
		<div>
			<label for="bluesky_url" class="flex items-center gap-2 text-sm font-medium">
				<AtSign class="h-4 w-4 text-[hsl(var(--brand-bluesky))]" aria-hidden="true" />
				Bluesky
			</label>
			<input
				type="url"
				id="bluesky_url"
				name="bluesky_url"
				bind:value={blueskyUrl}
				placeholder="https://bsky.app/profile/yourorg.bsky.social"
				class="mt-1 flex w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
			/>
		</div>

		<!-- Telegram -->
		{#if telegramEnabled}
			<div>
				<label for="telegram_url" class="flex items-center gap-2 text-sm font-medium">
					<Send class="h-4 w-4 text-[hsl(var(--brand-telegram-text))]" aria-hidden="true" />
					Telegram
				</label>
				<input
					type="url"
					id="telegram_url"
					name="telegram_url"
					bind:value={telegramUrl}
					placeholder="https://t.me/yourorg"
					class="mt-1 flex w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
				/>
			</div>
		{/if}
	</div>
</section>
