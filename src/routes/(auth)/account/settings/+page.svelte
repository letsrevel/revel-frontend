<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import { VISIBILITY_OPTIONS } from '$lib/schemas/preferences';
	import CityAutocomplete from '$lib/components/forms/CityAutocomplete.svelte';
	import type { CitySchema } from '$lib/api/generated';
	import { Loader2, Check, AlertTriangle } from 'lucide-svelte';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	let isSubmitting = $state(false);

	// Form state - initialize from data.preferences on page load
	let visibility = $state(
		data.preferences?.show_me_on_attendee_list || VISIBILITY_OPTIONS[0].value
	);
	let eventReminders = $state(data.preferences?.event_reminders ?? true);
	let silenceAll = $state(data.preferences?.silence_all_notifications ?? false);
	let selectedCity = $state<CitySchema | null>(data.preferences?.city || null);
	let overwriteChildren = $state(false);

	// Debug logging - fixed to use closures
	$effect(() => {
		console.log('[Settings] State:', {
			visibility,
			eventReminders,
			silenceAll,
			selectedCity,
			preferences: data.preferences
		});
	});

	let success = $derived(form?.success || false);
	let errors = $derived((form?.errors || {}) as Record<string, string>);
</script>

<svelte:head>
	<title>Settings - Revel</title>
	<meta name="description" content="Manage your Revel preferences and settings" />
</svelte:head>

<div class="container mx-auto max-w-2xl px-4 py-8">
	<div class="mb-8">
		<h1 class="text-3xl font-bold tracking-tight">Settings</h1>
		<p class="mt-2 text-muted-foreground">Manage your preferences and notification settings</p>
	</div>

	{#if success}
		<div
			role="status"
			class="mb-6 rounded-md border border-green-500 bg-green-50 p-4 dark:bg-green-950"
		>
			<div class="flex items-center gap-2">
				<Check class="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
				<p class="text-sm font-medium text-green-800 dark:text-green-200">
					Settings updated successfully
				</p>
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
		action="?/updatePreferences"
		use:enhance={() => {
			if (isSubmitting) return;
			isSubmitting = true;
			return async ({ result }) => {
				isSubmitting = false;
				if (result.type === 'success' && result.data?.preferences) {
					console.log('[Enhance] Got success result with preferences:', result.data.preferences);
					const prefs = result.data.preferences as typeof data.preferences;
					if (prefs) {
						visibility = prefs.show_me_on_attendee_list || VISIBILITY_OPTIONS[0].value;
						eventReminders = prefs.event_reminders ?? true;
						silenceAll = prefs.silence_all_notifications ?? false;
						selectedCity = prefs.city || null;
					}
					overwriteChildren = false; // Reset after save
					await applyAction(result);
				} else if (result.type === 'failure') {
					await applyAction(result);
				}
			};
		}}
		class="space-y-8"
	>
		<!-- Attendee List Visibility -->
		<section class="space-y-4">
			<div>
				<h2 class="text-lg font-semibold">Privacy</h2>
				<p class="text-sm text-muted-foreground">Control who can see you on attendee lists</p>
			</div>

			<div class="space-y-2">
				<label for="visibility-select" class="block text-sm font-medium">
					Show me on attendee lists
				</label>
				<select
					id="visibility-select"
					name="show_me_on_attendee_list"
					bind:value={visibility}
					disabled={isSubmitting}
					aria-invalid={!!errors.show_me_on_attendee_list}
					aria-describedby={errors.show_me_on_attendee_list ? 'visibility-error' : undefined}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {errors.show_me_on_attendee_list
						? 'border-destructive'
						: ''}"
				>
					{#each VISIBILITY_OPTIONS as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
				{#if errors.show_me_on_attendee_list}
					<p id="visibility-error" class="text-sm text-destructive" role="alert">
						{errors.show_me_on_attendee_list}
					</p>
				{/if}
			</div>
		</section>

		<!-- Notifications -->
		<section class="space-y-4">
			<div>
				<h2 class="text-lg font-semibold">Notifications</h2>
				<p class="text-sm text-muted-foreground">Manage how you receive updates</p>
			</div>

			<div class="space-y-4">
				<!-- Event Reminders -->
				<div class="flex items-center justify-between">
					<div class="flex-1">
						<label for="event-reminders" class="text-sm font-medium cursor-pointer">
							Event reminders
						</label>
						<p class="text-xs text-muted-foreground">
							Get reminded about upcoming events you're attending
						</p>
					</div>
					<label class="relative inline-flex cursor-pointer items-center">
						<input
							id="event-reminders"
							type="checkbox"
							name="event_reminders"
							value="true"
							bind:checked={eventReminders}
							disabled={isSubmitting}
							class="peer sr-only"
						/>
						<div
							class="peer h-6 w-11 rounded-full bg-input after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-border after:bg-background after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2"
						></div>
					</label>
				</div>
				{#if errors.event_reminders}
					<p class="text-sm text-destructive" role="alert">{errors.event_reminders}</p>
				{/if}

				<!-- Silence All Notifications -->
				<div class="flex items-center justify-between">
					<div class="flex-1">
						<label for="silence-all" class="text-sm font-medium cursor-pointer">
							Silence all notifications
						</label>
						<p class="text-xs text-muted-foreground">
							Disable all email and push notifications
						</p>
					</div>
					<label class="relative inline-flex cursor-pointer items-center">
						<input
							id="silence-all"
							type="checkbox"
							name="silence_all_notifications"
							value="true"
							bind:checked={silenceAll}
							disabled={isSubmitting}
							class="peer sr-only"
						/>
						<div
							class="peer h-6 w-11 rounded-full bg-input after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-border after:bg-background after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2"
						></div>
					</label>
				</div>
				{#if errors.silence_all_notifications}
					<p class="text-sm text-destructive" role="alert">{errors.silence_all_notifications}</p>
				{/if}
			</div>
		</section>

		<!-- Location Preferences -->
		<section class="space-y-4">
			<div>
				<h2 class="text-lg font-semibold">Location</h2>
				<p class="text-sm text-muted-foreground">Set your preferred city for event recommendations</p>
			</div>

			<CityAutocomplete
				value={selectedCity}
				onSelect={(city) => (selectedCity = city)}
				disabled={isSubmitting}
				error={errors.city_id}
			/>

			<!-- Hidden input for form submission - send empty string when null to explicitly clear -->
			{#if selectedCity?.id}
				<input type="hidden" name="city_id" value={selectedCity.id} />
			{:else}
				<input type="hidden" name="city_id" value="" />
			{/if}
		</section>

		<!-- Cascade Option -->
		<section class="space-y-4">
			<div
				class="rounded-md border border-orange-500/30 bg-orange-50/50 p-4 dark:bg-orange-950/20"
			>
				<div class="flex items-start gap-3">
					<AlertTriangle
						class="h-5 w-5 flex-shrink-0 text-orange-600 dark:text-orange-400"
						aria-hidden="true"
					/>
					<div class="flex-1 space-y-3">
						<div>
							<h3 class="text-sm font-semibold text-orange-800 dark:text-orange-200">
								Apply to all my preferences
							</h3>
							<p class="mt-1 text-xs text-orange-700 dark:text-orange-300">
								Check this to apply these settings to all your organization, series, and event-specific
								preferences. This will override any custom preferences you've set.
							</p>
						</div>

						<label class="flex items-center gap-2 cursor-pointer">
							<input
								id="overwrite-children"
								type="checkbox"
								name="overwrite_children"
								value="true"
								bind:checked={overwriteChildren}
								disabled={isSubmitting}
								class="h-4 w-4 rounded border-input text-orange-600 transition-colors focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
							/>
							<span class="text-sm font-medium text-orange-800 dark:text-orange-200">
								Apply these settings everywhere
							</span>
						</label>
					</div>
				</div>
			</div>
		</section>

		<!-- Action Buttons -->
		<div class="flex gap-4 border-t border-border pt-6">
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
