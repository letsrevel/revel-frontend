<script lang="ts">
	import { createMutation } from '@tanstack/svelte-query';
	import {
		organizationadminCreateResource,
		organizationadminUpdateResource
	} from '$lib/api/generated/sdk.gen';
	import type { AdditionalResourceSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { getApiUrl } from '$lib/config/api';
	import { X } from 'lucide-svelte';
	import ResourceForm from './ResourceForm.svelte';

	interface Props {
		resource?: AdditionalResourceSchema | null;
		organizationSlug: string;
		organizationId: string;
		onClose: () => void;
		onSuccess: () => void;
	}

	let { resource = null, organizationSlug, organizationId, onClose, onSuccess }: Props = $props();

	const accessToken = $derived(authStore.accessToken);
	let errorMessage = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});

	// Create mutation
	const createResourceMutation = createMutation(() => ({
		mutationFn: async (formData: FormData) => {
			// Extract values
			const file = formData.get('file') as File | null;
			const resourceType = formData.get('resource_type') as string;

			// Backend now expects multipart/form-data with individual form fields
			// Build multipart form data
			const multipartData = new FormData();

			// Add all schema fields as individual form fields
			multipartData.append('resource_type', resourceType);

			const name = formData.get('name');
			if (name) multipartData.append('name', name as string);

			const description = formData.get('description');
			if (description) multipartData.append('description', description as string);

			const visibility = formData.get('visibility') || 'members-only';
			multipartData.append('visibility', visibility as string);

			const displayOnOrgPage = formData.get('display_on_organization_page');
			multipartData.append('display_on_organization_page', displayOnOrgPage || 'true');

			// Add type-specific fields
			if (resourceType === 'link') {
				const linkValue = formData.get('link') as string;
				if (!linkValue || linkValue.trim() === '') {
					throw new Error('Link URL is required for link resources');
				}
				multipartData.append('link', linkValue.trim());
			} else if (resourceType === 'text') {
				const textValue = formData.get('text') as string;
				if (!textValue || textValue.trim() === '') {
					throw new Error('Text content is required for text resources');
				}
				multipartData.append('text', textValue.trim());
			} else if (resourceType === 'file') {
				if (!file) {
					throw new Error('File is required for file resources');
				}
				// File will be added as query parameter in URL
			}

			// Parse and add event_ids if present
			const eventIdsStr = formData.get('event_ids') as string | null;
			if (eventIdsStr) {
				try {
					const eventIds = JSON.parse(eventIdsStr);
					// For form-data, arrays need to be sent as multiple fields or JSON string
					eventIds.forEach((id: string) => {
						multipartData.append('event_ids', id);
					});
				} catch (e) {
					// Ignore parsing errors
				}
			}

			// Add file to form data if present (not as query param)
			if (file) {
				multipartData.append('file', file);
			}

			const url = getApiUrl(`organization-admin/${organizationSlug}/resources`);

			// Use fetch directly (SDK might not handle form-data properly)
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${accessToken}`
					// Don't set Content-Type - browser will set it with boundary for multipart
				},
				body: multipartData
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.detail || 'Failed to create resource');
			}

			return await response.json();
		},
		onSuccess: () => {
			onSuccess();
		},
		onError: (error: Error) => {
			errorMessage = error.message;
		}
	}));

	// Update mutation
	const updateResourceMutation = createMutation(() => ({
		mutationFn: async (formData: FormData) => {
			if (!resource?.id) {
				throw new Error('Resource ID is required for update');
			}

			// Build JSON body (update schema has all optional fields)
			const body: any = {};

			// Only include fields that are present in the form
			const name = formData.get('name');
			if (name !== null && name !== '') {
				body.name = (name as string).trim();
			}

			const description = formData.get('description');
			if (description !== null && description !== '') {
				body.description = (description as string).trim();
			}

			const visibility = formData.get('visibility');
			if (visibility) body.visibility = visibility;

			const displayOnOrgPage = formData.get('display_on_organization_page');
			if (displayOnOrgPage !== null) {
				body.display_on_organization_page = displayOnOrgPage === 'true';
			}

			// Add type-specific fields based on the resource type
			// For updates, only include if the field has a value
			const link = formData.get('link');
			if (link !== null && link !== '') {
				body.link = (link as string).trim();
			}

			const text = formData.get('text');
			if (text !== null && text !== '') {
				body.text = (text as string).trim();
			}

			// Parse event_ids if present
			const eventIdsStr = formData.get('event_ids') as string | null;
			if (eventIdsStr !== null) {
				try {
					body.event_ids = JSON.parse(eventIdsStr);
				} catch {
					body.event_ids = [];
				}
			}

			console.log('[ResourceModal] Updating resource:', {
				resourceId: resource.id,
				body
			});

			const response = await organizationadminUpdateResource({
				path: { slug: organizationSlug, resource_id: resource.id },
				body,
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				const errorDetail =
					typeof response.error === 'object' &&
					response.error !== null &&
					'detail' in response.error
						? (response.error.detail as string)
						: 'Failed to update resource';
				throw new Error(errorDetail);
			}

			if (!response.data) {
				throw new Error('Failed to update resource');
			}

			return response.data;
		},
		onSuccess: () => {
			onSuccess();
		},
		onError: (error: Error) => {
			errorMessage = error.message;
		}
	}));

	function handleSubmit(formData: FormData) {
		errorMessage = null;
		fieldErrors = {};

		if (resource) {
			updateResourceMutation.mutate(formData);
		} else {
			createResourceMutation.mutate(formData);
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}

	const isSubmitting = $derived(
		createResourceMutation.isPending || updateResourceMutation.isPending
	);

	let backdropElement: HTMLDivElement;
	let modalElement: HTMLDivElement;
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Modal Backdrop -->
<div
	bind:this={backdropElement}
	class="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm"
	onclick={handleBackdropClick}
	onkeydown={(e) => e.key === 'Enter' && handleBackdropClick(e as any)}
	role="dialog"
	aria-modal="true"
	aria-labelledby="modal-title"
	tabindex="-1"
>
	<!-- Modal Container with Padding -->
	<div class="flex min-h-full items-center justify-center p-4 sm:p-6 lg:p-8">
		<!-- Modal Content -->
		<div
			bind:this={modalElement}
			class="relative my-8 w-full max-w-2xl rounded-lg bg-background p-6 shadow-xl md:p-8"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.key === 'Enter' && e.stopPropagation()}
			role="document"
		>
			<!-- Header -->
			<div class="mb-6 flex items-start justify-between">
				<div>
					<h2 id="modal-title" class="text-2xl font-bold">
						{resource ? 'Edit Resource' : 'Add Resource'}
					</h2>
					<p class="mt-1 text-sm text-muted-foreground">
						{resource
							? 'Update the resource details below'
							: 'Create a new resource for your organization'}
					</p>
				</div>

				<button
					type="button"
					onclick={onClose}
					disabled={isSubmitting}
					class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
					aria-label="Close dialog"
				>
					<X class="h-5 w-5" aria-hidden="true" />
				</button>
			</div>

			<!-- Error Message -->
			{#if errorMessage}
				<div
					class="mb-6 rounded-md bg-destructive/10 p-4 text-destructive"
					role="alert"
					aria-live="assertive"
				>
					<p class="font-semibold">Error</p>
					<p class="mt-1 text-sm">{errorMessage}</p>
				</div>
			{/if}

			<!-- Form -->
			<ResourceForm
				{resource}
				{organizationSlug}
				{organizationId}
				onSubmit={handleSubmit}
				{isSubmitting}
				errors={fieldErrors}
			/>
		</div>
	</div>
</div>
