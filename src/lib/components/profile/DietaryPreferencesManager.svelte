<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		dietaryListMyDietaryPreferences,
		dietaryListDietaryPreferences,
		dietaryAddDietaryPreference,
		dietaryDeleteDietaryPreference,
		dietaryUpdateDietaryPreference
	} from '$lib/api';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { Plus, Trash2, Info, Loader2 } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import type {
		DietaryPreferenceSchema,
		UserDietaryPreferenceSchema
	} from '$lib/api/generated/types.gen.js';

	interface Props {
		authToken: string;
	}

	let { authToken }: Props = $props();

	// State
	let showAddDialog = $state(false);
	let selectedPreferenceId = $state('');
	let comment = $state('');
	let isPublic = $state(true);

	const queryClient = useQueryClient();

	// Fetch user's dietary preferences
	const userPreferencesQuery = createQuery(() => ({
		queryKey: ['dietary', 'my-preferences'],
		queryFn: async () => {
			const response = await dietaryListMyDietaryPreferences({
				headers: { Authorization: `Bearer ${authToken}` }
			});
			return response.data;
		}
	}));

	// Fetch available dietary preferences
	const availablePreferencesQuery = createQuery(() => ({
		queryKey: ['dietary', 'preferences'],
		queryFn: async () => {
			const response = await dietaryListDietaryPreferences({
				headers: { Authorization: `Bearer ${authToken}` }
			});
			return response.data;
		}
	}));

	// Add preference mutation
	const addPreferenceMutation = createMutation(() => ({
		mutationFn: async (data: { preference_id: string; comment: string; is_public: boolean }) => {
			const response = await dietaryAddDietaryPreference({
				body: data,
				headers: { Authorization: `Bearer ${authToken}` }
			});
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['dietary', 'my-preferences'] });
			toast.success(m['dietary.toast_preferenceAdded']());
			// Reset form
			showAddDialog = false;
			selectedPreferenceId = '';
			comment = '';
			isPublic = true;
		},
		onError: (error: Error) => {
			toast.error(m['dietary.toast_preferenceError']());
			console.error('Failed to add preference:', error);
		}
	}));

	// Delete preference mutation
	const deletePreferenceMutation = createMutation(() => ({
		mutationFn: async (preferenceId: string) => {
			await dietaryDeleteDietaryPreference({
				path: { preference_id: preferenceId },
				headers: { Authorization: `Bearer ${authToken}` }
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['dietary', 'my-preferences'] });
			toast.success(m['dietary.toast_preferenceRemoved']());
		},
		onError: (error: Error) => {
			toast.error(m['dietary.toast_preferenceError']());
			console.error('Failed to delete preference:', error);
		}
	}));

	// Update preference mutation
	const updatePreferenceMutation = createMutation(() => ({
		mutationFn: async ({
			id,
			data
		}: {
			id: string;
			data: { comment?: string; is_public?: boolean };
		}) => {
			const response = await dietaryUpdateDietaryPreference({
				path: { preference_id: id },
				body: data,
				headers: { Authorization: `Bearer ${authToken}` }
			});
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['dietary', 'my-preferences'] });
			toast.success(m['dietary.toast_preferenceAdded']());
		},
		onError: (error: Error) => {
			toast.error(m['dietary.toast_preferenceError']());
			console.error('Failed to update preference:', error);
		}
	}));

	// Derived state
	let userPreferences = $derived(
		(userPreferencesQuery.data as UserDietaryPreferenceSchema[] | undefined) ?? []
	);
	let availablePreferences = $derived(
		(availablePreferencesQuery.data as DietaryPreferenceSchema[] | undefined) ?? []
	);
	let isLoading = $derived(userPreferencesQuery.isLoading || availablePreferencesQuery.isLoading);
	let isAddingPreference = $derived(addPreferenceMutation.isPending);

	// Get preferences that user hasn't added yet
	let unselectedPreferences = $derived(
		availablePreferences.filter(
			(pref: DietaryPreferenceSchema) =>
				!userPreferences.some(
					(userPref: UserDietaryPreferenceSchema) => userPref.preference.id === pref.id
				)
		)
	);

	// Handlers
	function handleAddPreference() {
		if (!selectedPreferenceId) return;

		addPreferenceMutation.mutate({
			preference_id: selectedPreferenceId,
			comment: comment.trim(),
			is_public: isPublic
		});
	}

	function handleDeletePreference(id: string) {
		if (confirm(m['dietary.preferences_deleteConfirm']())) {
			deletePreferenceMutation.mutate(id);
		}
	}

	function handleToggleVisibility(pref: UserDietaryPreferenceSchema) {
		if (!pref.id) return;
		updatePreferenceMutation.mutate({
			id: pref.id,
			data: { is_public: !pref.is_public }
		});
	}
</script>

<div class="space-y-4">
	<div class="flex items-start justify-between">
		<div>
			<h3 class="text-lg font-semibold">{m['dietary.preferences_sectionHeading']()}</h3>
			<p class="text-sm text-muted-foreground">
				{m['dietary.preferences_sectionDescription']()}
			</p>
		</div>
		<button
			type="button"
			onclick={() => (showAddDialog = true)}
			disabled={isLoading || unselectedPreferences.length === 0}
			class="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
		>
			<Plus class="h-4 w-4" aria-hidden="true" />
			{m['dietary.profile_addPreferenceButton']()}
		</button>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-8">
			<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
			<span class="sr-only">Loading preferences...</span>
		</div>
	{:else if userPreferences.length === 0}
		<div class="rounded-md border border-dashed p-8 text-center">
			<p class="text-sm text-muted-foreground">{m['dietary.preferences_emptyState']()}</p>
			<button
				type="button"
				onclick={() => (showAddDialog = true)}
				disabled={unselectedPreferences.length === 0}
				class="mt-2 text-sm text-primary hover:underline disabled:opacity-50"
			>
				{m['dietary.preferences_emptyStateAction']()}
			</button>
		</div>
	{:else}
		<ul class="space-y-3" role="list">
			{#each userPreferences as pref (pref.id)}
				<li class="flex items-start gap-3 rounded-md border p-4">
					<div class="flex-1 space-y-2">
						<div class="flex items-center justify-between">
							<h4 class="font-medium">{pref.preference.name}</h4>
							<button
								type="button"
								onclick={() => handleToggleVisibility(pref)}
								class="rounded px-2 py-1 text-xs font-medium transition-colors {pref.is_public
									? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-950 dark:text-green-400'
									: 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'}"
								aria-label={pref.is_public
									? m['dietary.preferences_publicLabel']()
									: m['dietary.preferences_privateLabel']()}
							>
								{pref.is_public
									? m['dietary.preferences_publicLabel']()
									: m['dietary.preferences_privateLabel']()}
							</button>
						</div>

						{#if pref.comment}
							<p class="text-sm text-muted-foreground">{pref.comment}</p>
						{/if}
					</div>

					<button
						type="button"
						onclick={() => pref.id && handleDeletePreference(pref.id)}
						class="rounded p-2 text-destructive hover:bg-destructive/10"
						aria-label="Remove {pref.preference.name}"
					>
						<Trash2 class="h-4 w-4" aria-hidden="true" />
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	<!-- Add Preference Dialog -->
	{#if showAddDialog}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
			onclick={(e) => e.target === e.currentTarget && (showAddDialog = false)}
			onkeydown={(e) => e.key === 'Escape' && (showAddDialog = false)}
			role="dialog"
			aria-modal="true"
			aria-labelledby="add-preference-title"
			tabindex="-1"
		>
			<div class="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
				<h2 id="add-preference-title" class="mb-2 text-xl font-semibold">
					{m['dietary.addPreference_dialogTitle']()}
				</h2>
				<p class="mb-4 text-sm text-muted-foreground">
					{m['dietary.addPreference_dialogDescription']()}
				</p>

				<form
					onsubmit={(e) => {
						e.preventDefault();
						handleAddPreference();
					}}
					class="space-y-4"
				>
					<div class="space-y-2">
						<label for="preference-select" class="block text-sm font-medium">
							{m['dietary.addPreference_preferenceLabel']()}
						</label>
						<select
							id="preference-select"
							bind:value={selectedPreferenceId}
							required
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						>
							<option value="">{m['dietary.addPreference_preferencePlaceholder']()}</option>
							{#each unselectedPreferences as pref (pref.id)}
								<option value={pref.id}>{pref.name}</option>
							{/each}
						</select>
					</div>

					<div class="space-y-2">
						<label for="preference-comment" class="block text-sm font-medium">
							{m['dietary.addPreference_commentLabel']()}
						</label>
						<input
							id="preference-comment"
							type="text"
							bind:value={comment}
							placeholder={m['dietary.addPreference_commentPlaceholder']()}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						/>
					</div>

					<div class="space-y-2">
						<span class="block text-sm font-medium">
							{m['dietary.addPreference_visibilityLabel']()}
						</span>
						<div class="space-y-2">
							<label class="flex items-start gap-2">
								<input
									type="radio"
									name="visibility"
									value="public"
									checked={isPublic}
									onchange={() => (isPublic = true)}
									class="mt-1"
								/>
								<span class="text-sm">
									{m['dietary.addPreference_visibilityPublic']()}
								</span>
							</label>
							<label class="flex items-start gap-2">
								<input
									type="radio"
									name="visibility"
									value="private"
									checked={!isPublic}
									onchange={() => (isPublic = false)}
									class="mt-1"
								/>
								<span class="text-sm">
									{m['dietary.addPreference_visibilityPrivate']()}
								</span>
							</label>
						</div>
					</div>

					<div class="flex gap-3">
						<button
							type="button"
							onclick={() => (showAddDialog = false)}
							disabled={isAddingPreference}
							class="flex-1 rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
						>
							{m['dietary.addPreference_cancelButton']()}
						</button>
						<button
							type="submit"
							disabled={isAddingPreference || !selectedPreferenceId}
							class="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
						>
							{#if isAddingPreference}
								<span class="flex items-center justify-center gap-2">
									<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
									{m['dietary.addPreference_savingButton']()}
								</span>
							{:else}
								{m['dietary.addPreference_addButton']()}
							{/if}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>
