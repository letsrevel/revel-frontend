<script lang="ts">
	import type { OrganizationRetrieveSchema } from '$lib/api/generated/types.gen';
	import { cn } from '$lib/utils/cn';

	interface Props {
		organization: OrganizationRetrieveSchema;
		class?: string;
	}

	let { organization, class: className }: Props = $props();
</script>

<section aria-labelledby="organizer-heading" class={cn('space-y-4', className)}>
	<h2 id="organizer-heading" class="text-xl font-semibold">About the organizer</h2>

	<div class="rounded-lg border bg-card p-6">
		<!-- Organization Header -->
		<div class="flex items-start gap-4">
			{#if organization.logo}
				<img
					src={organization.logo}
					alt="{organization.name} logo"
					class="h-16 w-16 rounded-lg object-cover"
				/>
			{:else}
				<div
					class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-2xl font-bold text-primary-foreground"
				>
					{organization.name.charAt(0).toUpperCase()}
				</div>
			{/if}

			<div class="flex-1">
				<h3 class="text-lg font-semibold">{organization.name}</h3>
				{#if organization.description}
					<p class="mt-1 text-sm text-muted-foreground">
						{organization.description.slice(0, 100)}{organization.description.length > 100 ? '...' : ''}
					</p>
				{/if}
			</div>
		</div>


		<!-- View Profile Link -->
		<div class="mt-6">
			<a
				href="/org/{organization.slug}"
				class="inline-flex rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				View organization profile
			</a>
		</div>
	</div>
</section>
