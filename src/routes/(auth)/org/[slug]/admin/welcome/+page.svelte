<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { authStore } from '$lib/stores/auth.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import Sticker from '$lib/components/brand/Sticker.svelte';
	import SetupActions from '$lib/components/org-setup/SetupActions.svelte';
	import VisibilityStrip from '$lib/components/org-setup/VisibilityStrip.svelte';
	import { buildSetupProgress } from '$lib/utils/org-setup-progress';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	const { data }: Props = $props();

	// Layout data is merged into `data`, so it refreshes after invalidateAll().
	const organization = $derived(data.organization);
	const progress = $derived(buildSetupProgress(organization, data.setupCounts));
	const accessToken = $derived(authStore.accessToken ?? '');

	const headline = $derived(
		progress.event === 'none'
			? m['orgSetup.welcome.title']()
			: progress.event === 'draft'
				? m['orgSetup.welcome.titleDraft']()
				: m['orgSetup.welcome.titlePublished']()
	);

	const linkClass =
		'inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm';
</script>

<svelte:head>
	<title>{m['orgSetup.welcome.pageTitle']({ name: organization.name })} | Revel</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<!-- Celebration band inside the admin shell (the layout supplies the container,
     sidebar and <main>): a rounded `bg-secondary` panel, an audit-enforced pair
     in both modes, with PageHeader's `onBand` keeping the kicker/subtitle AA on
     it. The body is pulled up with -mt-12 onto an OPAQUE `bg-card` shell
     (pull-up opacity rule), inset from the panel's sides so it overlaps the
     bottom edge inside the rounded corners, never onto translucent blocks. -->
<div class="px-4 md:px-0">
	<section
		class="rounded-lg bg-secondary px-4 pb-20 pt-10 text-center text-secondary-foreground sm:pt-14"
	>
		<div class="mx-auto max-w-3xl">
			<Sticker rotate={-2} class="mb-5 text-base">
				{m['orgSetup.welcome.sticker']({ name: organization.name })}
			</Sticker>
			<PageHeader
				volume="poster"
				onBand
				kicker={m['orgSetup.welcome.kicker']()}
				title={headline}
				subtitle={progress.event === 'none'
					? m['orgSetup.welcome.subtitle']()
					: m['orgSetup.welcome.subtitleNext']()}
				class="text-center sm:flex-col sm:items-center"
			/>
		</div>
	</section>

	<div class="mx-auto -mt-12 max-w-3xl px-3 pb-8 sm:px-6">
		<div class="space-y-4 rounded-2xl border-2 bg-card p-4 shadow-poster md:p-6">
			<SetupActions
				orgSlug={organization.slug}
				{progress}
				defaultStripeEmail={organization.contact_email ?? ''}
				{accessToken}
				density="full"
			/>
			<VisibilityStrip
				orgSlug={organization.slug}
				visibility={organization.visibility}
				{accessToken}
				density="full"
			/>
		</div>

		<div
			class="mt-6 flex flex-col items-center gap-2 text-center text-sm text-muted-foreground sm:flex-row sm:justify-between sm:text-left"
		>
			<div class="flex flex-wrap items-center justify-center gap-x-2 sm:justify-start">
				<span>{m['orgSetup.welcome.later']()}</span>
				<ul
					class="flex flex-wrap justify-center gap-x-3 gap-y-1 sm:justify-start [&>li+li]:before:mr-3 [&>li+li]:before:content-['·']"
				>
					<li>
						<a
							href={resolve('/(auth)/org/[slug]/admin/settings', { slug: organization.slug })}
							class={linkClass}>{m['orgSetup.welcome.laterLogo']()}</a
						>
					</li>
					<li>
						<a
							href={resolve('/(auth)/org/[slug]/admin/members', { slug: organization.slug })}
							class={linkClass}>{m['orgSetup.welcome.laterTeam']()}</a
						>
					</li>
					<li>
						<a
							href={resolve('/(auth)/org/[slug]/admin/settings', { slug: organization.slug })}
							class={linkClass}>{m['orgSetup.welcome.laterDescription']()}</a
						>
					</li>
				</ul>
			</div>
			<a
				href={resolve('/(auth)/org/[slug]/admin', { slug: organization.slug })}
				class="{linkClass} font-medium text-foreground"
			>
				{m['orgSetup.welcome.skip']()}
			</a>
		</div>
	</div>
</div>
