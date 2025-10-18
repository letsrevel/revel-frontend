<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import { COMMON_PRONOUNS } from '$lib/schemas/profile';
	import { Loader2, Check } from 'lucide-svelte';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	let isSubmitting = $state(false);
	let manuallyShowingCustom = $state(false);

	// Form state
	let firstName = $state(data.user?.first_name || '');
	let lastName = $state(data.user?.last_name || '');
	let preferredName = $state(data.user?.preferred_name || '');
	let pronouns = $state(data.user?.pronouns || '');

	// Sync form state when data changes (after successful submission)
	$effect(() => {
		if (form?.success && data.user) {
			firstName = data.user.first_name || '';
			lastName = data.user.last_name || '';
			preferredName = data.user.preferred_name || '';
			pronouns = data.user.pronouns || '';
		}
	});

	// Restore form values on validation errors
	$effect(() => {
		if (form?.errors) {
			if (form.first_name !== undefined) firstName = form.first_name;
			if (form.last_name !== undefined) lastName = form.last_name;
			if (form.preferred_name !== undefined) preferredName = form.preferred_name;
			if (form.pronouns !== undefined) pronouns = form.pronouns;
		}
	});

	// Check if current pronouns is custom (not in common list)
	let showCustomPronouns = $derived(
		manuallyShowingCustom ||
			(pronouns !== '' &&
				!COMMON_PRONOUNS.slice(0, -1).includes(pronouns as (typeof COMMON_PRONOUNS)[number]))
	);

	let success = $derived(form?.success || false);
	let errors = $derived((form?.errors || {}) as Record<string, string>);
</script>

<svelte:head>
	<title>Profile - Revel</title>
	<meta name="description" content="Manage your Revel profile" />
</svelte:head>

<div class="container mx-auto max-w-2xl px-4 py-8">
	<div class="mb-8">
		<h1 class="text-3xl font-bold tracking-tight">Profile</h1>
		<p class="mt-2 text-muted-foreground">Manage your personal information</p>
	</div>

	{#if success}
		<div role="status" class="mb-6 rounded-md border border-green-500 bg-green-50 p-4 dark:bg-green-950">
			<div class="flex items-center gap-2">
				<Check class="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
				<p class="text-sm font-medium text-green-800 dark:text-green-200">Profile updated successfully</p>
			</div>
		</div>
	{/if}

	{#if errors.form}
		<div role="alert" class="mb-6 rounded-md border border-destructive bg-destructive/10 p-4">
			<p class="text-sm font-medium text-destructive">{errors.form}</p>
		</div>
	{/if}

	<form
		method="POST"
		action="?/updateProfile"
		use:enhance={() => {
			if (isSubmitting) return;
			isSubmitting = true;
			return async ({ update }) => {
				isSubmitting = false;
				await update();
			};
		}}
		class="space-y-6"
	>
		<div class="space-y-2">
			<label for="email" class="block text-sm font-medium">Email</label>
			<input
				id="email"
				type="email"
				value={data.user?.email || ''}
				disabled
				class="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
			/>
			<p class="text-xs text-muted-foreground">Email cannot be changed</p>
		</div>

		<div class="grid gap-6 sm:grid-cols-2">
			<div class="space-y-2">
				<label for="first_name" class="block text-sm font-medium">First Name</label>
				<input
					id="first_name"
					name="first_name"
					type="text"
					required
					bind:value={firstName}
					aria-invalid={!!errors.first_name}
					aria-describedby={errors.first_name ? 'first-name-error' : undefined}
					disabled={isSubmitting}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {errors.first_name ? 'border-destructive' : ''}"
				/>
				{#if errors.first_name}
					<p id="first-name-error" class="text-sm text-destructive" role="alert">{errors.first_name}</p>
				{/if}
			</div>

			<div class="space-y-2">
				<label for="last_name" class="block text-sm font-medium">Last Name</label>
				<input
					id="last_name"
					name="last_name"
					type="text"
					required
					bind:value={lastName}
					aria-invalid={!!errors.last_name}
					aria-describedby={errors.last_name ? 'last-name-error' : undefined}
					disabled={isSubmitting}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {errors.last_name ? 'border-destructive' : ''}"
				/>
				{#if errors.last_name}
					<p id="last-name-error" class="text-sm text-destructive" role="alert">{errors.last_name}</p>
				{/if}
			</div>
		</div>

		<div class="space-y-2">
			<label for="preferred_name" class="block text-sm font-medium">Preferred Name</label>
			<input
				id="preferred_name"
				name="preferred_name"
				type="text"
				required
				bind:value={preferredName}
				aria-invalid={!!errors.preferred_name}
				aria-describedby={errors.preferred_name ? 'preferred-name-error' : undefined}
				disabled={isSubmitting}
				class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {errors.preferred_name ? 'border-destructive' : ''}"
				placeholder="What should we call you?"
			/>
			<p class="text-xs text-muted-foreground">This is how you'll appear throughout Revel</p>
			{#if errors.preferred_name}
				<p id="preferred-name-error" class="text-sm text-destructive" role="alert">{errors.preferred_name}</p>
			{/if}
		</div>

		<div class="space-y-2">
			<label for="pronouns-select" class="block text-sm font-medium">Pronouns</label>
			{#if showCustomPronouns}
				<div class="space-y-2">
					<input
						id="pronouns"
						name="pronouns"
						type="text"
						required
						bind:value={pronouns}
						aria-invalid={!!errors.pronouns}
						aria-describedby={errors.pronouns ? 'pronouns-error' : undefined}
						disabled={isSubmitting}
						maxlength="10"
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {errors.pronouns ? 'border-destructive' : ''}"
						placeholder="e.g., ze/zir"
					/>
					<button
						type="button"
						onclick={() => {
							manuallyShowingCustom = false;
							pronouns = 'they/them';
						}}
						class="text-sm text-primary underline-offset-4 hover:underline"
					>
						Choose from common options
					</button>
				</div>
			{:else}
				<select
					id="pronouns-select"
					bind:value={pronouns}
					onchange={(e) => {
						const val = (e.target as HTMLSelectElement).value;
						if (val === 'custom') {
							manuallyShowingCustom = true;
							pronouns = '';
						}
					}}
					disabled={isSubmitting}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#each COMMON_PRONOUNS as option (option)}
						<option value={option === 'custom' ? 'custom' : option}>
							{option === 'custom' ? 'Custom...' : option}
						</option>
					{/each}
				</select>
				<input type="hidden" name="pronouns" value={pronouns} />
			{/if}
			{#if errors.pronouns}
				<p id="pronouns-error" class="text-sm text-destructive" role="alert">{errors.pronouns}</p>
			{/if}
		</div>

		<div class="flex gap-4">
			<button
				type="submit"
				disabled={isSubmitting}
				class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if isSubmitting}
					<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
					<span>Saving...</span>
				{:else}
					<span>Save Changes</span>
				{/if}
			</button>
		</div>
	</form>
</div>
