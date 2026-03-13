<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { XCircle, Loader2 } from 'lucide-svelte';
	import { organizationadminmembersListMembers } from '$lib/api/generated/sdk.gen';

	interface Props {
		emailTags: string[];
		organizationSlug: string;
		accessToken: string | null;
		placeholder?: string;
		onTagsChange: (tags: string[]) => void;
	}

	let {
		emailTags,
		organizationSlug,
		accessToken,
		placeholder = '',
		onTagsChange
	}: Props = $props();

	let emailInputValue = $state('');
	let emailSuggestions = $state<Array<{ email: string; name: string }>>([]);
	let showEmailSuggestions = $state(false);
	let selectedEmailIndex = $state(-1);
	let isLoadingEmailSuggestions = $state(false);
	let emailSearchTimeout: ReturnType<typeof setTimeout> | null = null;

	async function fetchEmailSuggestions(search: string): Promise<void> {
		if (!search.trim() || search.length < 2) {
			emailSuggestions = [];
			showEmailSuggestions = false;
			return;
		}

		isLoadingEmailSuggestions = true;

		try {
			const response = await organizationadminmembersListMembers({
				path: { slug: organizationSlug },
				query: { search, page_size: 10 },
				headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
			});

			if (response.data?.results) {
				emailSuggestions = response.data.results
					.filter((member) => member.user.email && !emailTags.includes(member.user.email))
					.map((member) => ({
						email: member.user.email!,
						name:
							member.user.preferred_name ||
							[member.user.first_name, member.user.last_name].filter(Boolean).join(' ') ||
							member.user.email!
					}));
				showEmailSuggestions = emailSuggestions.length > 0;
				selectedEmailIndex = -1;
			}
		} catch (error) {
			console.error('Failed to fetch email suggestions:', error);
			emailSuggestions = [];
			showEmailSuggestions = false;
		} finally {
			isLoadingEmailSuggestions = false;
		}
	}

	function addEmailTag(email: string) {
		const trimmed = email.trim();
		if (trimmed && !emailTags.includes(trimmed)) {
			onTagsChange([...emailTags, trimmed]);
		}
	}

	function removeEmailTag(email: string) {
		onTagsChange(emailTags.filter((e) => e !== email));
	}

	function selectEmailSuggestion(email: string): void {
		addEmailTag(email);
		emailInputValue = '';
		emailSuggestions = [];
		showEmailSuggestions = false;
		selectedEmailIndex = -1;
	}

	function handleEmailInput(e: Event): void {
		const value = (e.target as HTMLInputElement).value;
		emailInputValue = value;

		if (emailSearchTimeout) {
			clearTimeout(emailSearchTimeout);
		}

		emailSearchTimeout = setTimeout(() => {
			fetchEmailSuggestions(value);
		}, 300);
	}

	function handleEmailKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
			e.preventDefault();
			if (selectedEmailIndex >= 0 && emailSuggestions[selectedEmailIndex]) {
				selectEmailSuggestion(emailSuggestions[selectedEmailIndex].email);
			} else if (emailInputValue.trim()) {
				addEmailTag(emailInputValue);
				emailInputValue = '';
				emailSuggestions = [];
				showEmailSuggestions = false;
			}
		} else if (e.key === 'Backspace' && !emailInputValue && emailTags.length > 0) {
			onTagsChange(emailTags.slice(0, -1));
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (showEmailSuggestions && emailSuggestions.length > 0) {
				selectedEmailIndex = Math.min(selectedEmailIndex + 1, emailSuggestions.length - 1);
			}
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (showEmailSuggestions && emailSuggestions.length > 0) {
				selectedEmailIndex = Math.max(selectedEmailIndex - 1, -1);
			}
		} else if (e.key === 'Escape') {
			showEmailSuggestions = false;
			selectedEmailIndex = -1;
		}
	}

	function handleEmailBlur() {
		if (emailInputValue.trim()) {
			addEmailTag(emailInputValue);
			emailInputValue = '';
		}
	}

	function handleEmailPaste(e: ClipboardEvent) {
		e.preventDefault();
		const pastedText = e.clipboardData?.getData('text') || '';
		const emails = pastedText
			.split(/[\n,\s]+/)
			.map((e) => e.trim())
			.filter((e) => e.length > 0);

		const newTags = [...emailTags];
		emails.forEach((email) => {
			if (!newTags.includes(email)) {
				newTags.push(email);
			}
		});
		onTagsChange(newTags);
		emailInputValue = '';
	}
</script>

<div class="relative">
	<label class="block text-sm font-medium">{m['eventInvitationsAdmin.emailAddressesLabel']()}</label
	>
	<div
		class="mt-1 flex min-h-[80px] flex-wrap gap-2 rounded-md border-2 border-gray-300 bg-white p-2 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 dark:border-gray-600 dark:bg-gray-800"
	>
		{#each emailTags as email (email)}
			<span
				class="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-sm font-medium text-primary dark:bg-primary/20"
			>
				{email}
				<button
					type="button"
					onclick={() => removeEmailTag(email)}
					class="rounded-sm hover:bg-primary/20 dark:hover:bg-primary/30"
					aria-label="Remove {email}"
				>
					<XCircle class="h-3.5 w-3.5" aria-hidden="true" />
				</button>
			</span>
		{/each}
		<div class="relative min-w-[200px] flex-1">
			<input
				type="text"
				value={emailInputValue}
				oninput={handleEmailInput}
				onkeydown={handleEmailKeydown}
				onblur={() => {
					setTimeout(() => {
						showEmailSuggestions = false;
						handleEmailBlur();
					}, 200);
				}}
				onfocus={() => {
					if (emailInputValue.trim().length >= 2 && emailSuggestions.length > 0) {
						showEmailSuggestions = true;
					}
				}}
				placeholder={emailTags.length === 0 ? placeholder : ''}
				class="w-full border-0 bg-transparent p-1 text-sm outline-none placeholder:text-muted-foreground dark:text-gray-100"
				autocomplete="off"
				onpaste={handleEmailPaste}
				role="combobox"
				aria-expanded={showEmailSuggestions}
				aria-controls="email-suggestions"
				aria-activedescendant={selectedEmailIndex >= 0
					? `email-suggestion-${selectedEmailIndex}`
					: undefined}
			/>

			{#if showEmailSuggestions && emailSuggestions.length > 0}
				<div
					id="email-suggestions"
					role="listbox"
					class="absolute left-0 top-full z-10 mt-1 max-h-60 w-full min-w-[300px] overflow-auto rounded-md border border-input bg-popover text-popover-foreground shadow-md"
				>
					{#each emailSuggestions as suggestion, index}
						<button
							type="button"
							id="email-suggestion-{index}"
							role="option"
							aria-selected={selectedEmailIndex === index}
							onclick={() => selectEmailSuggestion(suggestion.email)}
							class="flex w-full cursor-pointer flex-col items-start px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground {selectedEmailIndex ===
							index
								? 'bg-accent text-accent-foreground'
								: ''}"
						>
							<span class="font-medium">{suggestion.name}</span>
							<span class="text-xs text-muted-foreground">{suggestion.email}</span>
						</button>
					{/each}
				</div>
			{/if}

			{#if isLoadingEmailSuggestions}
				<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
					<Loader2 class="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
				</div>
			{/if}
		</div>
	</div>
	<p class="mt-1 text-xs text-muted-foreground">
		{m['eventInvitationsAdmin.emailHint']()}
	</p>
</div>
