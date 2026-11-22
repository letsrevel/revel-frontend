<script lang="ts">
	import { MapPin, Send, AtSign } from '@lucide/svelte';
	import Instagram from '$lib/components/icons/brand/Instagram.svelte';
	import Facebook from '$lib/components/icons/brand/Facebook.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		organization: {
			name: string;
			instagram_url?: string | null;
			facebook_url?: string | null;
			bluesky_url?: string | null;
			telegram_url?: string | null;
		};
		logoUrl: string | null | undefined;
		locationDisplay: string | null | undefined;
	}

	const { organization, logoUrl, locationDisplay }: Props = $props();

	const hasSocialLinks = $derived(
		!!(
			organization.instagram_url ||
			organization.facebook_url ||
			organization.bluesky_url ||
			organization.telegram_url
		)
	);
</script>

<!--
	Poster ribbon (uplift, spec §9) — the event page's move, applied to the
	other public identity page. A solid `--poster-band` block (Hearty Purple,
	or a branded org's primary) under the cover, with the org's logo promoted OUT of the header row
	and onto it as a tilted white sticker straddling the cut. The logo used
	to be a 64px thumbnail beside the title; here it is the page's identity
	mark, which is what an org profile is for.

	The band now carries the identity too, like the event page: the sticker
	sits left of the kicker, the display name and the location/social row
	from `sm` up (stacked on mobile). Join/Follow/etc. stay on the wash as
	the first row below the band.

	Ribbon and sticker are mode-INERT by the imagery rule (a poster panel is
	not a surface), and so is every text layer on the band: ALL of it is solid
	`poster-white` (kicker via PageHeader `onBand` = currentColor, h1, location,
	social icons) — never primary/muted-foreground, which fail on the band, and
	never an alpha, since a branded org's band is only guaranteed >= 4.5:1
	against plain white (#1053). Pairs, default Hearty Purple band:
	  poster-white on poster-band      →  5.52:1 (kicker, location text, icons)
	  poster-white on poster-band, h1  →  5.52:1 (large text; AA 3:1)
	  white on crimson-DEEP            →  4.59:1 (logo-less initial tile)
	The initial tile's gradient ends on `crimson-deep`, not raw
	`poster-crimson`: white on raw Light Crimson is 4.33:1, which fails AA
	for the tile's bold letter — the trap app.css documents at the
	`--poster-crimson-deep` declaration. That tile is the DEFAULT for any org
	without a logo, not an edge case, which is also why the sticker is kept
	here rather than delegated to `brand/LogoChip`: LogoChip renders NOTHING
	without a logo (it is pure ornament), and this mark is not ornament.
-->
<div class="bg-poster-band">
	<div class="container mx-auto px-6 pb-8 md:px-8">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
			<div
				class="-mt-8 inline-block shrink-0 -rotate-1 rounded-[1.25rem] bg-poster-white p-3 shadow-poster-lg"
			>
				{#if logoUrl}
					<img
						src={logoUrl}
						alt="{organization.name} logo"
						class="h-16 w-16 rounded-lg object-cover md:h-20 md:w-20"
					/>
				{:else}
					<div
						class="flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-poster-purple to-poster-crimson-deep text-xl font-black text-poster-white md:h-20 md:w-20 md:text-2xl"
					>
						{organization.name.charAt(0).toUpperCase()}
					</div>
				{/if}
			</div>

			<!-- Identity: white display title on the band (celebration volume). -->
			<div class="min-w-0 flex-1 text-poster-white sm:pt-4">
				<PageHeader
					volume="celebration"
					onBand
					kicker={m['organizationProfile.kicker']()}
					title={organization.name}
					class="mb-2"
				/>

				<!-- Metadata Row -->
				<div class="flex flex-wrap items-center gap-4 text-sm text-poster-white">
					<!-- Location -->
					{#if locationDisplay}
						<div class="flex items-center gap-1.5">
							<MapPin class="h-4 w-4" aria-hidden="true" />
							<span>{locationDisplay}</span>
						</div>
					{/if}

					<!-- Social Links -->
					{#if hasSocialLinks}
						<div class="flex items-center gap-3">
							{#if organization.instagram_url}
								<!-- eslint-disable svelte/no-navigation-without-resolve -- external URL (off-site); not an internal route -->
								<a
									href={organization.instagram_url}
									target="_blank"
									rel="noopener noreferrer"
									class="text-poster-white transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-poster-white focus-visible:ring-offset-2 focus-visible:ring-offset-poster-band"
									aria-label={m['organizationProfile.social_instagram']()}
								>
									<Instagram class="h-5 w-5" aria-hidden="true" />
								</a>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							{/if}
							{#if organization.facebook_url}
								<!-- eslint-disable svelte/no-navigation-without-resolve -- external URL (off-site); not an internal route -->
								<a
									href={organization.facebook_url}
									target="_blank"
									rel="noopener noreferrer"
									class="text-poster-white transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-poster-white focus-visible:ring-offset-2 focus-visible:ring-offset-poster-band"
									aria-label={m['organizationProfile.social_facebook']()}
								>
									<Facebook class="h-5 w-5" aria-hidden="true" />
								</a>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							{/if}
							{#if organization.bluesky_url}
								<!-- eslint-disable svelte/no-navigation-without-resolve -- external URL (off-site); not an internal route -->
								<a
									href={organization.bluesky_url}
									target="_blank"
									rel="noopener noreferrer"
									class="text-poster-white transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-poster-white focus-visible:ring-offset-2 focus-visible:ring-offset-poster-band"
									aria-label={m['organizationProfile.social_bluesky']()}
								>
									<AtSign class="h-5 w-5" aria-hidden="true" />
								</a>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							{/if}
							{#if organization.telegram_url}
								<!-- eslint-disable svelte/no-navigation-without-resolve -- external URL (off-site); not an internal route -->
								<a
									href={organization.telegram_url}
									target="_blank"
									rel="noopener noreferrer"
									class="text-poster-white transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-poster-white focus-visible:ring-offset-2 focus-visible:ring-offset-poster-band"
									aria-label={m['organizationProfile.social_telegram']()}
								>
									<Send class="h-5 w-5" aria-hidden="true" />
								</a>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
