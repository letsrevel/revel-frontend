<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { PageData, ActionData } from './$types';
	import CityAutocomplete from '$lib/components/forms/CityAutocomplete.svelte';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import type { CitySchema } from '$lib/api/generated';
	import { Building2, AlertCircle, Check } from 'lucide-svelte';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	// Form state using Svelte 5 Runes
	let name = $state(data.organization.name);
	let slug = $state(data.organization.slug);
	let description = $state(data.organization.description || '');
	let selectedCity = $state<CitySchema | null>(data.organization.city || null);
	let visibility = $state('public');
	let isSubmitting = $state(false);

	// Validate slug format
	let slugErrors = $derived.by(() => {
		if (!slug.trim()) {
			return ['URL slug is required'];
		}

		const errors: string[] = [];

		if (!/^[a-zA-Z0-9-_]+$/.test(slug)) {
			errors.push('Only letters, numbers, hyphens, and underscores are allowed');
		}

		if (slug.length < 3) {
			errors.push('Slug must be at least 3 characters');
		}

		if (slug.length > 50) {
			errors.push('Slug must be less than 50 characters');
		}

		return errors;
	});

	// Check if form is valid
	let isValid = $derived(name.trim().length > 0 && slugErrors.length === 0);

	// Errors from server-side validation
	let errors = $derived((form?.errors || {}) as Record<string, string>);
	let success = $derived(form?.success || false);

	/**
	 * Handle city selection
	 */
	function handleCitySelect(city: CitySchema | null) {
		selectedCity = city;
	}

	/**
	 * Reset form to original values
	 */
	function handleCancel() {
		name = data.organization.name;
		slug = data.organization.slug;
		description = data.organization.description || '';
		selectedCity = data.organization.city || null;
	}

	// Redirect if slug changed
	$effect(() => {
		if (success && form?.newSlug && form.newSlug !== data.organization.slug) {
			setTimeout(() => {
				goto(`/org/${form.newSlug}/admin/settings`);
			}, 1000);
		}
	});
</script>

<svelte:head>
	<title>Settings - {data.organization.name} | Revel</title>
	<meta name="description" content="Manage your organization settings" />
</svelte:head>

<div class="min-h-screen bg-gray-50 px-4 py-8 dark:bg-gray-900 sm:px-6 lg:px-8">
	<div class="mx-auto max-w-2xl">
		<!-- Header -->
		<div class="mb-8">
			<div class="mb-2 flex items-center gap-3">
				<Building2 class="h-8 w-8 text-blue-600 dark:text-blue-400" aria-hidden="true" />
				<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Organization Settings</h1>
			</div>
			<p class="text-gray-600 dark:text-gray-400">
				Update your organization's name, URL, location, and description
			</p>
		</div>

		<!-- Success Message -->
		{#if success}
			<div
				class="mb-6 flex gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20"
				role="alert"
			>
				<Check
					class="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400"
					aria-hidden="true"
				/>
				<div>
					<p class="text-sm font-medium text-green-800 dark:text-green-200">
						Organization settings updated successfully!
					</p>
					{#if form?.newSlug && form.newSlug !== data.organization.slug}
						<p class="mt-1 text-xs text-green-700 dark:text-green-300">Redirecting to new URL...</p>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Error Message -->
		{#if errors.form}
			<div
				class="mb-6 flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
				role="alert"
			>
				<AlertCircle
					class="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400"
					aria-hidden="true"
				/>
				<p class="text-sm font-medium text-red-800 dark:text-red-200">{errors.form}</p>
			</div>
		{/if}

		<!-- Settings Form -->
		<form
			method="POST"
			use:enhance={() => {
				isSubmitting = true;
				return ({ update }) => {
					update().then(() => {
						isSubmitting = false;
					});
				};
			}}
			class="space-y-6 rounded-lg bg-white p-6 shadow dark:bg-gray-800"
		>
			<!-- Organization Name -->
			<div>
				<label for="name" class="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
					Organization Name
					<span class="text-red-500" aria-label="required">*</span>
				</label>
				<input
					type="text"
					id="name"
					name="name"
					bind:value={name}
					placeholder="e.g., Tech Community"
					required
					disabled={isSubmitting}
					aria-describedby={!name.trim() ? 'name-hint' : undefined}
					aria-invalid={!!errors.name}
					class="w-full rounded-lg border-2 bg-white px-4 py-2 text-gray-900 transition-colors placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400 {!name.trim() ||
					errors.name
						? 'border-red-300 focus:border-red-500'
						: 'border-gray-300 focus:border-blue-500 dark:border-gray-600'}"
				/>
				{#if !name.trim()}
					<p id="name-hint" class="mt-1 text-sm text-red-600 dark:text-red-400">
						Organization name is required
					</p>
				{:else if errors.name}
					<p class="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
				{/if}
			</div>

			<!-- URL Slug -->
			<div>
				<label for="slug" class="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
					URL Slug
					<span class="text-red-500" aria-label="required">*</span>
				</label>
				<div class="mb-2 flex items-center gap-2">
					<span class="text-sm text-gray-600 dark:text-gray-400">/org/</span>
					<input
						type="text"
						id="slug"
						name="slug"
						bind:value={slug}
						placeholder="tech-community"
						required
						disabled={isSubmitting}
						aria-invalid={slugErrors.length > 0 || !!errors.slug}
						aria-describedby={slugErrors.length > 0 || errors.slug ? 'slug-errors' : 'slug-hint'}
						class="flex-1 rounded-lg border-2 bg-white px-4 py-2 text-gray-900 transition-colors placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400 {slugErrors.length >
							0 || errors.slug
							? 'border-red-300 focus:border-red-500'
							: 'border-gray-300 focus:border-blue-500 dark:border-gray-600'}"
					/>
				</div>

				{#if slugErrors.length > 0 || errors.slug}
					<div id="slug-errors" class="space-y-1">
						{#each slugErrors as error}
							<p class="text-sm text-red-600 dark:text-red-400">{error}</p>
						{/each}
						{#if errors.slug}
							<p class="text-sm text-red-600 dark:text-red-400">{errors.slug}</p>
						{/if}
					</div>
				{:else}
					<p id="slug-hint" class="text-xs text-gray-600 dark:text-gray-400">
						Letters, numbers, hyphens, and underscores only
					</p>
				{/if}
			</div>

			<!-- City Selection -->
			<div>
				<label for="city" class="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
					City
				</label>
				<div id="city">
					<CityAutocomplete
						value={selectedCity}
						onSelect={handleCitySelect}
						disabled={isSubmitting}
						label=""
						description=""
					/>
				</div>
				<input type="hidden" name="city_id" value={selectedCity?.id ?? ''} />
			</div>

			<!-- Visibility (hidden from UI but required for API) -->
			<input type="hidden" name="visibility" value={visibility} />

			<!-- Description -->
			<div>
				<MarkdownEditor
					bind:value={description}
					label="Description"
					placeholder="Tell people about your organization... (Markdown supported)"
					rows={6}
					disabled={isSubmitting}
				/>
				<input type="hidden" name="description" value={description} />
			</div>

			<!-- Form Actions -->
			<div class="flex gap-3 border-t border-gray-200 pt-6 dark:border-gray-700">
				<button
					type="submit"
					disabled={!isValid || isSubmitting}
					aria-busy={isSubmitting}
					class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if isSubmitting}
						<span class="inline-block animate-spin">⏳</span>
						Saving...
					{:else}
						Save Changes
					{/if}
				</button>
				<button
					type="button"
					onclick={handleCancel}
					disabled={isSubmitting}
					class="flex-1 rounded-lg border-2 border-gray-300 px-4 py-2 font-medium text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700"
				>
					Cancel
				</button>
			</div>
		</form>

		<!-- Info Box -->
		<div
			class="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20"
		>
			<p class="text-sm text-blue-800 dark:text-blue-200">
				<strong>Note:</strong> Changing your URL slug will update your organization's public URL. Any
				old links may become outdated.
			</p>
		</div>
	</div>
</div>

<style lang="postcss">
	:global(body) {
		@apply bg-gray-50 dark:bg-gray-900;
	}
</style>
