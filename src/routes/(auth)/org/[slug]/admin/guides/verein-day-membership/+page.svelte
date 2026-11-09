<script lang="ts">
	import { resolve } from '$app/paths';
	import { Info } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import { canPerformAction } from '$lib/utils/permissions';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	const { data }: Props = $props();

	const slug = $derived(data.organization.slug);

	// Staff can open this guide with any admin access, but two of its links lead to
	// screens that need a specific permission (the Members page 403s without
	// manage_members; creating a questionnaire needs create_questionnaire). Owners
	// pass canPerformAction. Steps the viewer cannot act on show a note, not a dead link.
	const canManageMembers = $derived(
		canPerformAction(data.permissions, data.organization.id, 'manage_members')
	);
	const canCreateQuestionnaire = $derived(
		canPerformAction(data.permissions, data.organization.id, 'create_questionnaire')
	);

	const linkClass =
		'inline-flex min-h-[44px] items-center font-medium underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm';

	// Real admin screens, resolved per step. The Members page opens straight on the
	// Tiers tab through the same `?tab=` deep link the page already reads.
	const steps = $derived([
		{
			n: 1,
			title: m['verein.guide.step1.title'](),
			body: m['verein.guide.step1.body'](),
			tip: null,
			needs: canManageMembers ? null : m['verein.guide.needs.manageMembers'](),
			link: m['verein.guide.step1.link'](),
			href: `${resolve('/(auth)/org/[slug]/admin/members', { slug })}?tab=tiers`
		},
		{
			n: 2,
			title: m['verein.guide.step2.title'](),
			body: m['verein.guide.step2.body'](),
			tip: m['verein.guide.step2.tip'](),
			needs: null,
			link: m['verein.guide.step2.link'](),
			href: resolve('/(auth)/org/[slug]/admin/events', { slug })
		},
		{
			n: 3,
			title: m['verein.guide.step3.title'](),
			body: m['verein.guide.step3.body'](),
			tip: null,
			needs: canCreateQuestionnaire ? null : m['verein.guide.needs.createQuestionnaire'](),
			link: m['verein.guide.step3.link'](),
			href: resolve('/(auth)/org/[slug]/admin/questionnaires/new', { slug })
		},
		{
			n: 4,
			title: m['verein.guide.step4.title'](),
			body: m['verein.guide.step4.body'](),
			tip: null,
			needs: canManageMembers ? null : m['verein.guide.needs.manageMembers'](),
			link: m['verein.guide.step4.link'](),
			href: resolve('/(auth)/org/[slug]/admin/members/register', { slug })
		}
	]);
</script>

<svelte:head>
	<title>{m['verein.guide.title']()} | Revel</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
	<PageHeader
		volume="studio"
		kicker={m['verein.guide.kicker']()}
		title={m['verein.guide.title']()}
		subtitle={m['verein.guide.subtitle']()}
	/>

	<aside
		class="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-4 text-sm font-medium"
		data-testid="verein-guide-disclaimer"
	>
		<Info class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
		<p>{m['verein.guide.disclaimer']()}</p>
	</aside>

	<p class="text-sm leading-relaxed">{m['verein.guide.intro']()}</p>

	<ol class="space-y-4">
		{#each steps as step (step.n)}
			<li
				class="rounded-lg border border-border bg-card p-4"
				aria-labelledby="verein-step-{step.n}"
			>
				<SectionHeader
					id="verein-step-{step.n}"
					level={2}
					kicker={m['verein.guide.stepLabel']({ number: step.n })}
					title={step.title}
				/>
				<p class="mt-2 text-sm leading-relaxed">{step.body}</p>
				{#if step.tip}
					<p class="mt-2 text-sm leading-relaxed text-muted-foreground">{step.tip}</p>
				{/if}
				{#if step.needs}
					<p
						class="mt-2 text-sm font-medium text-muted-foreground"
						data-testid="verein-guide-needs-{step.n}"
					>
						{step.needs}
					</p>
				{:else}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- href is built from resolve() in the steps array above -->
					<a class={linkClass} href={step.href}>{step.link}</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{/if}
			</li>
		{/each}
	</ol>

	<section
		class="rounded-lg border border-border bg-muted/40 p-4"
		aria-labelledby="verein-shortcut"
	>
		<SectionHeader id="verein-shortcut" level={2} title={m['verein.guide.shortcut.title']()} />
		<p class="mt-2 text-sm leading-relaxed">{m['verein.guide.shortcut.body']()}</p>
	</section>

	<p class="text-sm text-muted-foreground">{m['verein.guide.footer']()}</p>
</div>
