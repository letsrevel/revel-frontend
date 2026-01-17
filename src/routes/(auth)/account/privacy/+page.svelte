<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import {
		Trash2,
		AlertTriangle,
		Mail,
		Loader2,
		Download,
		Check,
		FileIcon,
		FolderOpen
	} from 'lucide-svelte';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { questionnairefileListFiles, questionnairefileDeleteFile } from '$lib/api/generated';
	import type { QuestionnaireFileSchema } from '$lib/api/generated';
	import { getImageUrl } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		form: ActionData;
	}

	let { form }: Props = $props();

	// State for confirmation modal
	let showDeletionModal = $state(false);
	let confirmed = $state(false);
	let isSubmitting = $state(false);
	let isExporting = $state(false);

	// Files section state
	let deletingFileId = $state<string | null>(null);
	let showFileDeleteModal = $state(false);
	let fileToDelete = $state<QuestionnaireFileSchema | null>(null);

	// Success states
	let success = $derived(form?.success || false);
	let exportSuccess = $derived(form?.exportSuccess || false);

	// Error handling
	let errors = $derived((form?.errors || {}) as Record<string, string>);

	// Query client for cache invalidation
	const queryClient = useQueryClient();

	// Query for user's files
	const filesQuery = createQuery(() => ({
		queryKey: ['user-files'],
		queryFn: async () => {
			const response = await questionnairefileListFiles({
				query: { page: 1, page_size: 100 }
			});
			return response.data?.results || [];
		}
	}));

	// Mutation for deleting files
	const deleteMutation = createMutation(() => ({
		mutationFn: async (fileId: string) => {
			await questionnairefileDeleteFile({ path: { file_id: fileId } });
			return fileId;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['user-files'] });
			queryClient.invalidateQueries({ queryKey: ['questionnaire-files'] });
			deletingFileId = null;
		},
		onError: () => {
			deletingFileId = null;
		}
	}));

	function openFileDeleteModal(file: QuestionnaireFileSchema) {
		fileToDelete = file;
		showFileDeleteModal = true;
	}

	function closeFileDeleteModal() {
		showFileDeleteModal = false;
		fileToDelete = null;
	}

	function confirmDeleteFile() {
		if (!fileToDelete) return;
		deletingFileId = fileToDelete.id;
		deleteMutation.mutate(fileToDelete.id);
		closeFileDeleteModal();
	}

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	function isImage(mimeType: string): boolean {
		return mimeType.startsWith('image/');
	}

	function openDeletionModal() {
		showDeletionModal = true;
		confirmed = false;
	}

	function closeDeletionModal() {
		showDeletionModal = false;
		confirmed = false;
	}
</script>

<svelte:head>
	<title>{m['accountPrivacyPage.pageTitle']()}</title>
	<meta name="description" content={m['accountPrivacyPage.pageDescription']()} />
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<!-- Page Header -->
	<div class="mb-8">
		<h1 class="text-3xl font-bold tracking-tight">{m['accountPrivacyPage.title']()}</h1>
		<p class="mt-2 text-muted-foreground">
			{m['accountPrivacyPage.subtitle']()}
		</p>
	</div>

	<!-- Success Message -->
	{#if success}
		<div
			role="status"
			class="mb-8 rounded-md border border-green-500 bg-green-50 p-6 dark:bg-green-950"
		>
			<div class="flex items-start gap-3">
				<Mail class="h-6 w-6 flex-shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
				<div class="flex-1 space-y-2">
					<p class="text-sm font-medium text-green-800 dark:text-green-200">
						{m['accountPrivacyPage.deletionEmailSent']()}
					</p>
					<p class="text-sm text-green-700 dark:text-green-300">
						{m['accountPrivacyPage.deletionEmailBody']()}
					</p>
					<p class="text-xs text-green-600 dark:text-green-400">
						{m['accountPrivacyPage.deletionEmailIgnore']()}
					</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Error Message -->
	{#if errors.form}
		<div role="alert" class="mb-8 rounded-md border border-destructive bg-destructive/10 p-4">
			<p class="text-sm font-medium text-destructive">{errors.form}</p>
		</div>
	{/if}

	<!-- Data Export Section -->
	<section class="mb-12 rounded-lg border border-border bg-card p-6">
		<div class="flex items-start gap-4">
			<div
				class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/10"
			>
				<Download class="h-6 w-6 text-primary" aria-hidden="true" />
			</div>
			<div class="flex-1">
				<h2 class="text-xl font-semibold">{m['accountPrivacyPage.exportDataTitle']()}</h2>
				<p class="mt-2 text-sm text-muted-foreground">
					{m['accountPrivacyPage.exportDataDescription']()}
				</p>

				<!-- Export Success Message -->
				{#if exportSuccess}
					<div
						role="status"
						class="mt-4 rounded-md border border-green-500 bg-green-50 p-4 dark:bg-green-950"
					>
						<div class="flex items-start gap-2">
							<Check
								class="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400"
								aria-hidden="true"
							/>
							<div class="flex-1">
								<p class="text-sm font-medium text-green-800 dark:text-green-200">
									{m['accountPrivacyPage.exportRequestReceived']()}
								</p>
								<p class="mt-1 text-sm text-green-700 dark:text-green-300">
									We'll email you a download link when your data export is ready. This usually takes
									a few minutes.
								</p>
							</div>
						</div>
					</div>
				{/if}

				<!-- Export Error Message -->
				{#if errors.exportForm}
					<div role="alert" class="mt-4 rounded-md border border-destructive bg-destructive/10 p-4">
						<p class="text-sm font-medium text-destructive">{errors.exportForm}</p>
					</div>
				{/if}

				<div class="mt-4">
					<h3 class="text-sm font-medium">{m['accountPrivacyPage.whatsIncluded']()}</h3>
					<ul class="mt-2 space-y-1 text-sm text-muted-foreground">
						<li class="flex items-center gap-2">
							<span class="text-primary">•</span>
							{m['accountPrivacyPage.export_profileInfo']()}
						</li>
						<li class="flex items-center gap-2">
							<span class="text-primary">•</span>
							{m['accountPrivacyPage.export_eventRsvps']()}
						</li>
						<li class="flex items-center gap-2">
							<span class="text-primary">•</span>
							{m['accountPrivacyPage.export_questionnaires']()}
						</li>
						<li class="flex items-center gap-2">
							<span class="text-primary">•</span>
							{m['accountPrivacyPage.export_organizations']()}
						</li>
					</ul>
				</div>

				<form
					method="POST"
					action="?/exportData"
					use:enhance={() => {
						if (isExporting) return;
						isExporting = true;

						return async ({ update }) => {
							isExporting = false;
							await update();
						};
					}}
					class="mt-6"
				>
					<button
						type="submit"
						disabled={isExporting || exportSuccess}
						class="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isExporting}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
							<span>{m['accountPrivacyPage.requestingExport']()}</span>
						{:else if exportSuccess}
							<Check class="h-4 w-4" aria-hidden="true" />
							<span>{m['accountPrivacyPage.exportRequested']()}</span>
						{:else}
							<Download class="h-4 w-4" aria-hidden="true" />
							<span>{m['accountPrivacyPage.requestDataExport']()}</span>
						{/if}
					</button>
					<p class="mt-2 text-xs text-muted-foreground">
						{m['accountPrivacyPage.exportLimitNote']()}
					</p>
				</form>
			</div>
		</div>
	</section>

	<!-- Your Files Section -->
	<section class="mb-12 rounded-lg border border-border bg-card p-6">
		<div class="flex items-start gap-4">
			<div
				class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/10"
			>
				<FolderOpen class="h-6 w-6 text-primary" aria-hidden="true" />
			</div>
			<div class="flex-1">
				<h2 class="text-xl font-semibold">{m['accountPrivacyPage.yourFilesTitle']()}</h2>
				<p class="mt-2 text-sm text-muted-foreground">
					{m['accountPrivacyPage.yourFilesDescription']()}
				</p>

				<div class="mt-6">
					{#if filesQuery.isPending}
						<div class="flex items-center justify-center py-8">
							<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
							<span class="ml-2 text-sm text-muted-foreground"
								>{m['accountPrivacyPage.loadingFiles']()}</span
							>
						</div>
					{:else if filesQuery.error}
						<div class="rounded-md border border-destructive bg-destructive/10 p-4">
							<p class="text-sm text-destructive">{m['accountPrivacyPage.filesLoadError']()}</p>
						</div>
					{:else if filesQuery.data && filesQuery.data.length > 0}
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{#each filesQuery.data as file (file.id)}
								<div class="relative flex items-center gap-3 rounded-lg border bg-background p-3">
									{#if isImage(file.mime_type) && file.file_url}
										<img
											src={getImageUrl(file.file_url)}
											alt={file.original_filename}
											class="h-12 w-12 rounded object-cover"
										/>
									{:else}
										<div class="flex h-12 w-12 items-center justify-center rounded bg-muted">
											<FileIcon class="h-6 w-6 text-muted-foreground" aria-hidden="true" />
										</div>
									{/if}
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm font-medium">{file.original_filename}</p>
										<p class="text-xs text-muted-foreground">
											{formatFileSize(file.file_size)}
										</p>
									</div>
									<Button
										variant="ghost"
										size="icon"
										class="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
										onclick={() => openFileDeleteModal(file)}
										disabled={deletingFileId === file.id}
										aria-label={m['accountPrivacyPage.deleteFile']()}
									>
										{#if deletingFileId === file.id}
											<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
										{:else}
											<Trash2 class="h-4 w-4" aria-hidden="true" />
										{/if}
									</Button>
								</div>
							{/each}
						</div>
						<p class="mt-4 text-xs text-muted-foreground">
							{m['accountPrivacyPage.filesCount']({
								count: filesQuery.data.length,
								plural: filesQuery.data.length === 1 ? '' : 's'
							})}
						</p>
					{:else}
						<div class="flex flex-col items-center justify-center py-8 text-center">
							<FolderOpen class="h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
							<p class="mt-4 text-sm font-medium">{m['accountPrivacyPage.noFilesTitle']()}</p>
							<p class="mt-1 text-xs text-muted-foreground">
								{m['accountPrivacyPage.noFilesDescription']()}
							</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</section>

	<!-- Account Deletion Section -->
	<section class="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
		<div class="flex items-start gap-4">
			<div
				class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10"
			>
				<AlertTriangle class="h-6 w-6 text-destructive" aria-hidden="true" />
			</div>
			<div class="flex-1">
				<h2 class="text-xl font-semibold text-destructive">
					{m['accountPrivacyPage.dangerZone']()}
				</h2>
				<p class="mt-2 text-sm text-muted-foreground">
					Once you delete your account, there is no going back. All your data will be permanently
					removed and cannot be recovered.
				</p>

				<div class="mt-6">
					<h3 class="text-sm font-medium">{m['accountPrivacyPage.whatWillBeDeleted']()}</h3>
					<ul class="mt-2 space-y-1 text-sm text-muted-foreground">
						<li class="flex items-center gap-2">
							<span class="text-destructive">✗</span>
							{m['accountPrivacyPage.delete_profileCredentials']()}
						</li>
						<li class="flex items-center gap-2">
							<span class="text-destructive">✗</span>
							{m['accountPrivacyPage.delete_rsvpsTickets']()}
						</li>
						<li class="flex items-center gap-2">
							<span class="text-destructive">✗</span>
							{m['accountPrivacyPage.export_questionnaires']()}
						</li>
						<li class="flex items-center gap-2">
							<span class="text-destructive">✗</span>
							{m['accountPrivacyPage.delete_memberships']()}
						</li>
						<li class="flex items-center gap-2">
							<span class="text-destructive">✗</span>
							{m['accountPrivacyPage.delete_files']()}
						</li>
					</ul>
				</div>

				<button
					type="button"
					onclick={openDeletionModal}
					disabled={success}
					class="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<Trash2 class="h-4 w-4" aria-hidden="true" />
					{m['accountPrivacyPage.deleteMyAccount']()}
				</button>
			</div>
		</div>
	</section>
</div>

<!-- Deletion Confirmation Modal -->
{#if showDeletionModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="deletion-modal-title"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeDeletionModal();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') closeDeletionModal();
		}}
	>
		<div class="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
			<div class="mb-4 flex items-start gap-3">
				<div
					class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10"
				>
					<AlertTriangle class="h-5 w-5 text-destructive" aria-hidden="true" />
				</div>
				<div class="flex-1">
					<h2 id="deletion-modal-title" class="text-lg font-semibold">
						{m['accountPrivacyPage.modal_title']()}
					</h2>
					<p class="mt-1 text-sm text-muted-foreground">
						This action cannot be undone. We'll send you a confirmation email to verify this
						request.
					</p>
				</div>
			</div>

			<div class="mb-6 space-y-2 rounded-md bg-destructive/5 p-4">
				<p class="text-sm font-medium">{m['accountPrivacyPage.modal_listTitle']()}</p>
				<ul class="space-y-1 text-sm text-muted-foreground">
					<li class="flex items-center gap-2">
						<span class="text-destructive">✗</span>
						{m['accountPrivacyPage.modal_profileData']()}
					</li>
					<li class="flex items-center gap-2">
						<span class="text-destructive">✗</span>
						{m['accountPrivacyPage.delete_rsvpsTickets']()}
					</li>
					<li class="flex items-center gap-2">
						<span class="text-destructive">✗</span>
						{m['accountPrivacyPage.modal_questionnaires']()}
					</li>
					<li class="flex items-center gap-2">
						<span class="text-destructive">✗</span>
						{m['accountPrivacyPage.modal_memberships']()}
					</li>
				</ul>
			</div>

			<form
				method="POST"
				action="?/requestDeletion"
				use:enhance={() => {
					if (isSubmitting || !confirmed) return;
					isSubmitting = true;

					return async ({ update }) => {
						isSubmitting = false;
						await update();
						closeDeletionModal();
					};
				}}
				class="space-y-4"
			>
				<!-- Confirmation Checkbox -->
				<div class="flex items-start gap-2">
					<input
						id="confirm-deletion"
						type="checkbox"
						bind:checked={confirmed}
						disabled={isSubmitting}
						class="mt-0.5 h-4 w-4 rounded border-input text-destructive transition-colors focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						required
					/>
					<label for="confirm-deletion" class="text-sm">
						{m['accountPrivacyPage.modal_confirmLabel']()}
					</label>
				</div>

				<!-- Action Buttons -->
				<div class="flex gap-3">
					<button
						type="button"
						onclick={closeDeletionModal}
						disabled={isSubmitting}
						class="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isSubmitting || !confirmed}
						class="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isSubmitting}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
							<span>{m['accountPrivacyPage.modal_sending']()}</span>
						{:else}
							<span>{m['accountPrivacyPage.modal_sendEmail']()}</span>
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- File Deletion Confirmation Modal -->
{#if showFileDeleteModal && fileToDelete}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="file-deletion-modal-title"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeFileDeleteModal();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') closeFileDeleteModal();
		}}
	>
		<div class="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
			<div class="mb-4 flex items-start gap-3">
				<div
					class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10"
				>
					<AlertTriangle class="h-5 w-5 text-destructive" aria-hidden="true" />
				</div>
				<div class="flex-1">
					<h2 id="file-deletion-modal-title" class="text-lg font-semibold">
						{m['accountPrivacyPage.fileDeleteModal_title']()}
					</h2>
					<p class="mt-1 text-sm text-muted-foreground">
						{m['accountPrivacyPage.fileDeleteModal_description']()}
					</p>
				</div>
			</div>

			<div class="mb-6 rounded-md bg-muted/50 p-4">
				<div class="flex items-center gap-3">
					{#if isImage(fileToDelete.mime_type) && fileToDelete.file_url}
						<img
							src={getImageUrl(fileToDelete.file_url)}
							alt={fileToDelete.original_filename}
							class="h-12 w-12 rounded object-cover"
						/>
					{:else}
						<div class="flex h-12 w-12 items-center justify-center rounded bg-muted">
							<FileIcon class="h-6 w-6 text-muted-foreground" aria-hidden="true" />
						</div>
					{/if}
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium">{fileToDelete.original_filename}</p>
						<p class="text-xs text-muted-foreground">{formatFileSize(fileToDelete.file_size)}</p>
					</div>
				</div>
			</div>

			<div class="mb-6 rounded-md border border-amber-500/30 bg-amber-50 p-4 dark:bg-amber-950/30">
				<p class="text-sm text-amber-800 dark:text-amber-200">
					{m['accountPrivacyPage.fileDeleteModal_warning']()}
				</p>
			</div>

			<div class="flex gap-3">
				<button
					type="button"
					onclick={closeFileDeleteModal}
					class="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					{m['accountPrivacyPage.fileDeleteModal_cancel']()}
				</button>
				<button
					type="button"
					onclick={confirmDeleteFile}
					class="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					<Trash2 class="h-4 w-4" aria-hidden="true" />
					{m['accountPrivacyPage.fileDeleteModal_confirm']()}
				</button>
			</div>
		</div>
	</div>
{/if}
