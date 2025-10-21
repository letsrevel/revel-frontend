<script lang="ts">
	import { createMutation } from '@tanstack/svelte-query';
	import {
		organizationadminCreateResource,
		organizationadminUpdateResource
	} from '$lib/api/generated/sdk.gen';
	import type { AdditionalResourceSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { X } from 'lucide-svelte';
	import ResourceForm from './ResourceForm.svelte';

	interface Props {
		resource?: AdditionalResourceSchema | null;
		organizationSlug: string;
		onClose: () => void;
		onSuccess: () => void;
	}

	let { resource = null, organizationSlug, onClose, onSuccess }: Props = $props();

	const accessToken = $derived(authStore.accessToken);
	let errorMessage = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});

	// Create mutation
	const createResourceMutation = createMutation(() => ({
		mutationFn: async (formData: FormData) => {
			const response = await organizationadminCreateResource({
				path: { slug: organizationSlug },
				body: formData as any,
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
						: 'Failed to create resource';
				throw new Error(errorDetail);
			}

			if (!response.data) {
				throw new Error('Failed to create resource');
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

	// Update mutation
	const updateResourceMutation = createMutation(() => ({
		mutationFn: async (formData: FormData) => {
			if (!resource?.id) {
				throw new Error('Resource ID is required for update');
			}

			const response = await organizationadminUpdateResource({
				path: { slug: organizationSlug, resource_id: resource.id },
				body: formData as any,
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

	// Debugging: Log scroll behavior and dimensions
	let backdropElement: HTMLDivElement;
	let modalElement: HTMLDivElement;

	$effect(() => {
		if (backdropElement && modalElement) {
			console.log('[ResourceModal] Modal opened - Dimensions:', {
				viewport: {
					width: window.innerWidth,
					height: window.innerHeight
				},
				backdrop: {
					scrollHeight: backdropElement.scrollHeight,
					clientHeight: backdropElement.clientHeight,
					scrollTop: backdropElement.scrollTop
				},
				modal: {
					scrollHeight: modalElement.scrollHeight,
					clientHeight: modalElement.clientHeight,
					offsetTop: modalElement.offsetTop
				}
			});

			// Log scroll events
			const handleScroll = () => {
				console.log('[ResourceModal] Scroll event:', {
					scrollTop: backdropElement.scrollTop,
					scrollHeight: backdropElement.scrollHeight,
					clientHeight: backdropElement.clientHeight
				});
			};

			backdropElement.addEventListener('scroll', handleScroll);

			return () => {
				backdropElement.removeEventListener('scroll', handleScroll);
			};
		}
	});
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
				onSubmit={handleSubmit}
				{isSubmitting}
				errors={fieldErrors}
			/>
		</div>
	</div>
</div>
