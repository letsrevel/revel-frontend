<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Card } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		Check,
		CornerDownRight,
		FileIcon,
		Download,
		AlertCircle,
		X,
		ZoomIn
	} from 'lucide-svelte';
	import type { QuestionAnswerDetailSchema } from '$lib/api/generated';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import { getImageUrl } from '$lib/utils';

	interface MultipleChoiceAnswerContent {
		option_id: string;
		option_text: string;
		is_correct?: boolean;
	}

	interface FreeTextAnswerContent {
		answer: string;
	}

	interface FileUploadAnswerContent {
		file_id: string;
		original_filename: string;
		mime_type: string;
		file_size: number;
		file_url?: string | null;
	}

	interface Props {
		answers: QuestionAnswerDetailSchema[];
	}

	let { answers }: Props = $props();

	// Image preview modal state
	let previewImage = $state<{ url: string; filename: string } | null>(null);

	function openImagePreview(url: string, filename: string) {
		previewImage = { url, filename };
	}

	function closeImagePreview() {
		previewImage = null;
	}

	// Check if a question is conditional (has depends_on_option_id)
	function isConditionalQuestion(answer: QuestionAnswerDetailSchema): boolean {
		// The answer schema should include depends_on_option_id if the question is conditional
		return !!(answer as { depends_on_option_id?: string | null }).depends_on_option_id;
	}

	function formatAnswer(answer: QuestionAnswerDetailSchema): string {
		const content = answer.answer_content;

		if (!Array.isArray(content) || content.length === 0) {
			return 'No answer provided';
		}

		if (answer.question_type === 'free_text') {
			const freeTextContent = content[0] as unknown as FreeTextAnswerContent;
			return freeTextContent.answer || 'No answer provided';
		}

		if (answer.question_type === 'multiple_choice') {
			const options = content as unknown as MultipleChoiceAnswerContent[];
			const optionTexts = options.map((opt) => opt.option_text).filter(Boolean);
			return optionTexts.length > 0
				? optionTexts.join(', ')
				: m['questionAnswerDisplay.noOptionSelected']();
		}

		if (answer.question_type === 'file_upload') {
			const files = content as unknown as FileUploadAnswerContent[];
			const fileNames = files.map((f) => f.original_filename).filter(Boolean);
			return fileNames.length > 0
				? fileNames.join(', ')
				: m['questionAnswerDisplay.noFilesUploaded']?.() || 'No files uploaded';
		}

		return m['questionAnswerDisplay.unknownAnswerFormat']();
	}

	function getSelectedOptions(answer: QuestionAnswerDetailSchema): MultipleChoiceAnswerContent[] {
		if (
			answer.question_type === 'multiple_choice' &&
			Array.isArray(answer.answer_content) &&
			answer.answer_content.length > 0
		) {
			return answer.answer_content as unknown as MultipleChoiceAnswerContent[];
		}
		return [];
	}

	function getUploadedFiles(answer: QuestionAnswerDetailSchema): FileUploadAnswerContent[] {
		if (
			answer.question_type === 'file_upload' &&
			Array.isArray(answer.answer_content) &&
			answer.answer_content.length > 0
		) {
			return answer.answer_content as unknown as FileUploadAnswerContent[];
		}
		return [];
	}

	// Format file size for display
	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	// Check if file is an image
	function isImage(mimeType: string): boolean {
		return mimeType.startsWith('image/');
	}

	// Get badge label for question type
	function getQuestionTypeBadge(questionType: string): string {
		switch (questionType) {
			case 'multiple_choice':
				return m['questionAnswerDisplay.multipleChoice']?.() || 'Multiple Choice';
			case 'free_text':
				return m['questionAnswerDisplay.freeText']?.() || 'Free Text';
			case 'file_upload':
				return m['questionAnswerDisplay.fileUpload']?.() || 'File Upload';
			default:
				return questionType;
		}
	}
</script>

<!--
  Question Answer Display Component

  Displays a question and its corresponding answer from a questionnaire submission.
  Handles both free text and multiple choice question types.

  @component
  @example
  <QuestionAnswerDisplay answers={submissionAnswers} />
-->
<div class="space-y-4">
	{#each answers as answer (answer.question_id)}
		{@const isConditional = isConditionalQuestion(answer)}
		<Card class="p-4 {isConditional ? 'border-l-2 border-l-primary/50 bg-primary/5' : ''}">
			<div class="space-y-3">
				<!-- Question Text -->
				<div class="flex items-start gap-2">
					{#if isConditional}
						<CornerDownRight class="mt-0.5 h-4 w-4 shrink-0 text-primary/60" aria-hidden="true" />
					{/if}
					<Badge variant={isConditional ? 'secondary' : 'outline'} class="shrink-0">
						{getQuestionTypeBadge(answer.question_type)}
					</Badge>
					{#if isConditional}
						<Badge variant="outline" class="shrink-0 text-xs">Conditional</Badge>
					{/if}
					<div class="flex-1">
						<MarkdownContent
							content={answer.question_text}
							class="text-base font-medium leading-tight"
						/>
					</div>
				</div>

				<!-- Answer Content -->
				<div class="pl-0 md:pl-4">
					{#if answer.question_type === 'free_text'}
						<div class="rounded-md bg-muted/50 p-3">
							<p class="whitespace-pre-wrap text-sm">{formatAnswer(answer)}</p>
						</div>
					{:else if answer.question_type === 'multiple_choice'}
						{@const selectedOptions = getSelectedOptions(answer)}
						{#if selectedOptions.length > 0}
							<div class="space-y-2">
								{#each selectedOptions as option (option.option_id)}
									<div class="flex items-center gap-2 text-sm">
										<div
											class="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10"
										>
											<Check class="h-3 w-3 text-primary" aria-hidden="true" />
										</div>
										<span>{option.option_text}</span>
										{#if option.is_correct !== undefined}
											<Badge variant={option.is_correct ? 'default' : 'secondary'} class="ml-2">
												{option.is_correct ? 'Correct' : 'Incorrect'}
											</Badge>
										{/if}
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-sm italic text-muted-foreground">
								{m['questionAnswerDisplay.noOptionSelected']()}
							</p>
						{/if}
					{:else if answer.question_type === 'file_upload'}
						{@const uploadedFiles = getUploadedFiles(answer)}
						{#if uploadedFiles.length > 0}
							<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
								{#each uploadedFiles as file (file.file_id)}
									<div class="flex items-center gap-3 rounded-lg border bg-card p-3">
										{#if file.file_url && isImage(file.mime_type)}
											<button
												type="button"
												class="group relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
												onclick={() =>
													openImagePreview(getImageUrl(file.file_url!), file.original_filename)}
												aria-label={m['questionAnswerDisplay.previewImage']?.() || 'Preview image'}
											>
												<img
													src={getImageUrl(file.file_url)}
													alt={file.original_filename}
													class="h-full w-full object-cover transition-transform group-hover:scale-110"
												/>
												<div
													class="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40"
												>
													<ZoomIn
														class="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100"
														aria-hidden="true"
													/>
												</div>
											</button>
										{:else if file.file_url}
											<div class="flex h-12 w-12 items-center justify-center rounded bg-muted">
												<FileIcon class="h-6 w-6 text-muted-foreground" aria-hidden="true" />
											</div>
										{:else}
											<div class="flex h-12 w-12 items-center justify-center rounded bg-muted/50">
												<AlertCircle class="h-6 w-6 text-muted-foreground" aria-hidden="true" />
											</div>
										{/if}
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium">{file.original_filename}</p>
											<p class="text-xs text-muted-foreground">
												{formatFileSize(file.file_size)}
											</p>
										</div>
										{#if file.file_url}
											<div class="flex shrink-0 gap-1">
												{#if isImage(file.mime_type)}
													<Button
														variant="ghost"
														size="icon"
														class="h-8 w-8"
														onclick={() =>
															openImagePreview(getImageUrl(file.file_url!), file.original_filename)}
														aria-label={m['questionAnswerDisplay.previewImage']?.() ||
															'Preview image'}
													>
														<ZoomIn class="h-4 w-4" />
													</Button>
												{/if}
												<Button
													variant="ghost"
													size="icon"
													class="h-8 w-8"
													href={getImageUrl(file.file_url)}
													target="_blank"
													rel="noopener noreferrer"
													aria-label={m['questionAnswerDisplay.downloadFile']?.() ||
														'Download file'}
												>
													<Download class="h-4 w-4" />
												</Button>
											</div>
										{:else}
											<span class="text-xs text-muted-foreground">
												{m['questionAnswerDisplay.fileUnavailable']?.() || 'Unavailable'}
											</span>
										{/if}
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-sm italic text-muted-foreground">
								{m['questionAnswerDisplay.noFilesUploaded']?.() || 'No files uploaded'}
							</p>
						{/if}
					{:else}
						<p class="text-sm italic text-muted-foreground">
							{m['questionAnswerDisplay.unknownAnswerFormat']()}
						</p>
					{/if}
				</div>
			</div>
		</Card>
	{/each}
</div>

<!-- Image Preview Modal -->
{#if previewImage}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
		role="dialog"
		aria-modal="true"
		aria-label={m['questionAnswerDisplay.imagePreview']?.() || 'Image preview'}
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeImagePreview();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') closeImagePreview();
		}}
	>
		<div class="relative max-h-[90vh] max-w-[90vw]">
			<!-- Close button -->
			<Button
				variant="ghost"
				size="icon"
				class="absolute -right-2 -top-2 z-10 h-10 w-10 rounded-full bg-background shadow-lg hover:bg-accent"
				onclick={closeImagePreview}
				aria-label={m['questionAnswerDisplay.closePreview']?.() || 'Close preview'}
			>
				<X class="h-5 w-5" />
			</Button>

			<!-- Image -->
			<img
				src={previewImage.url}
				alt={previewImage.filename}
				class="max-h-[85vh] max-w-[85vw] rounded-lg object-contain shadow-2xl"
			/>

			<!-- Filename -->
			<div class="absolute -bottom-10 left-0 right-0 text-center">
				<p class="text-sm text-white/80">{previewImage.filename}</p>
			</div>
		</div>
	</div>
{/if}
