<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		AnnouncementListSchema,
		AnnouncementSchema,
		AnnouncementStatus
	} from '$lib/api/generated/types.gen';
	import {
		organizationadminannouncementsListAnnouncements,
		organizationadminannouncementsDeleteAnnouncement,
		organizationadminannouncementsSendAnnouncement,
		organizationadminannouncementsGetAnnouncement,
		eventpublicdiscoveryListEvents,
		organizationadminmembersListMembershipTiers
	} from '$lib/api/generated/sdk.gen';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Tabs from '$lib/components/ui/tabs';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription
	} from '$lib/components/ui/dialog';
	import { Plus, Search, Megaphone, Loader2, AlertTriangle } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { formatRelativeTime } from '$lib/utils/time';
	import type { PageData } from './$types';
	import AnnouncementCard from '$lib/components/announcements/AnnouncementCard.svelte';
	import AnnouncementModal from '$lib/components/announcements/AnnouncementModal.svelte';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const queryClient = useQueryClient();

	// State
	let activeTab = $state<AnnouncementStatus>('draft');
	let searchQuery = $state('');
	let modalOpen = $state(false);
	let selectedAnnouncement = $state<AnnouncementSchema | null>(null);
	let deleteDialogOpen = $state(false);
	let announcementToDelete = $state<AnnouncementListSchema | null>(null);
	let sendDialogOpen = $state(false);
	let announcementToSend = $state<AnnouncementListSchema | null>(null);
	let viewDialogOpen = $state(false);
	let viewingAnnouncement = $state<AnnouncementSchema | null>(null);
	let isLoadingView = $state(false);

	// Derived
	let accessToken = $derived(authStore.accessToken);
	let organizationSlug = $derived(data.organization.slug);
	let organizationId = $derived(data.organization.id);

	// Fetch announcements
	let announcementsQuery = createQuery(() => ({
		queryKey: ['announcements', organizationSlug, activeTab, searchQuery],
		queryFn: async () => {
			const response = await organizationadminannouncementsListAnnouncements({
				path: { slug: organizationSlug },
				query: {
					status: activeTab,
					search: searchQuery || undefined,
					page_size: 100
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw response.error;
			return response.data;
		},
		enabled: !!accessToken
	}));

	// Fetch events for the modal
	let eventsQuery = createQuery(() => ({
		queryKey: ['admin-events', organizationId],
		queryFn: async () => {
			const response = await eventpublicdiscoveryListEvents({
				query: { organization: organizationId, page_size: 100 }
			});
			if (response.error) throw response.error;
			return response.data;
		},
		enabled: !!accessToken && !!organizationId
	}));

	// Fetch tiers for the modal
	let tiersQuery = createQuery(() => ({
		queryKey: ['membership-tiers', organizationSlug],
		queryFn: async () => {
			const response = await organizationadminmembersListMembershipTiers({
				path: { slug: organizationSlug },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw response.error;
			return response.data;
		},
		enabled: !!accessToken
	}));

	// Delete mutation
	const deleteMutation = createMutation(() => ({
		mutationFn: async (announcementId: string) => {
			const response = await organizationadminannouncementsDeleteAnnouncement({
				path: { slug: organizationSlug, announcement_id: announcementId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw response.error;
			return response.data;
		},
		onSuccess: () => {
			toast.success(m['announcements.toast.deleted']());
			queryClient.invalidateQueries({ queryKey: ['announcements', organizationSlug] });
			deleteDialogOpen = false;
			announcementToDelete = null;
		},
		onError: () => {
			toast.error(m['announcements.toast.error']());
		}
	}));

	// Send mutation
	const sendMutation = createMutation(() => ({
		mutationFn: async (announcementId: string) => {
			const response = await organizationadminannouncementsSendAnnouncement({
				path: { slug: organizationSlug, announcement_id: announcementId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw response.error;
			return response.data;
		},
		onSuccess: () => {
			toast.success(m['announcements.toast.sent']());
			queryClient.invalidateQueries({ queryKey: ['announcements', organizationSlug] });
			sendDialogOpen = false;
			announcementToSend = null;
		},
		onError: () => {
			toast.error(m['announcements.toast.error']());
		}
	}));

	// Derived data
	let announcements = $derived(announcementsQuery.data?.results ?? []);
	let events = $derived(eventsQuery.data?.results ?? []);
	let tiers = $derived(tiersQuery.data ?? []);
	let isLoading = $derived(announcementsQuery.isLoading);

	// Handlers
	function openCreateModal() {
		selectedAnnouncement = null;
		modalOpen = true;
	}

	function openEditModal(announcement: AnnouncementListSchema) {
		// We need to fetch full announcement details for editing
		// For now, cast it - the modal will handle partial data
		selectedAnnouncement = announcement as unknown as AnnouncementSchema;
		modalOpen = true;
	}

	function handleModalSuccess() {
		modalOpen = false;
		selectedAnnouncement = null;
	}

	function confirmDelete(announcement: AnnouncementListSchema) {
		announcementToDelete = announcement;
		deleteDialogOpen = true;
	}

	function confirmSend(announcement: AnnouncementListSchema) {
		announcementToSend = announcement;
		sendDialogOpen = true;
	}

	function handleCancelDelete() {
		deleteDialogOpen = false;
		announcementToDelete = null;
	}

	function handleCancelSend() {
		sendDialogOpen = false;
		announcementToSend = null;
	}

	function handleDelete() {
		if (announcementToDelete?.id) {
			deleteMutation.mutate(announcementToDelete.id);
		}
	}

	function handleSend() {
		if (announcementToSend?.id) {
			sendMutation.mutate(announcementToSend.id);
		}
	}

	async function openViewDialog(announcement: AnnouncementListSchema) {
		if (!announcement.id) return;
		isLoadingView = true;
		viewDialogOpen = true;

		try {
			const response = await organizationadminannouncementsGetAnnouncement({
				path: { slug: organizationSlug, announcement_id: announcement.id },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw response.error;
			viewingAnnouncement = response.data ?? null;
		} catch {
			toast.error(m['announcements.toast.error']());
			viewDialogOpen = false;
		} finally {
			isLoadingView = false;
		}
	}

	function closeViewDialog() {
		viewDialogOpen = false;
		viewingAnnouncement = null;
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold">{m['announcements.title']()}</h1>
			<p class="text-muted-foreground">{m['announcements.pageDescription']()}</p>
		</div>
		<Button onclick={openCreateModal}>
			<Plus class="mr-2 h-4 w-4" aria-hidden="true" />
			{m['announcements.new']()}
		</Button>
	</div>

	<!-- Tabs -->
	<Tabs.Root bind:value={activeTab}>
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<Tabs.List>
				<Tabs.Trigger value="draft">{m['announcements.tabs.drafts']()}</Tabs.Trigger>
				<Tabs.Trigger value="sent">{m['announcements.tabs.sent']()}</Tabs.Trigger>
			</Tabs.List>

			<!-- Search -->
			<div class="relative w-full sm:w-64">
				<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input type="search" placeholder="Search..." bind:value={searchQuery} class="pl-9" />
			</div>
		</div>

		<!-- Content -->
		<Tabs.Content value="draft" class="mt-4">
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			{:else if announcements.length === 0}
				<div
					class="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center"
				>
					<Megaphone class="mb-4 h-12 w-12 text-muted-foreground/50" />
					<h3 class="font-medium">{m['announcements.empty.drafts']()}</h3>
					<p class="text-sm text-muted-foreground">
						{m['announcements.empty.draftsDescription']()}
					</p>
					<Button onclick={openCreateModal} class="mt-4">
						<Plus class="mr-2 h-4 w-4" />
						{m['announcements.new']()}
					</Button>
				</div>
			{:else}
				<div class="space-y-3">
					{#each announcements as announcement (announcement.id)}
						<AnnouncementCard
							{announcement}
							onView={() => openViewDialog(announcement)}
							onEdit={() => openEditModal(announcement)}
							onDelete={() => confirmDelete(announcement)}
							onSend={() => confirmSend(announcement)}
						/>
					{/each}
				</div>
			{/if}
		</Tabs.Content>

		<Tabs.Content value="sent" class="mt-4">
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			{:else if announcements.length === 0}
				<div
					class="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center"
				>
					<Megaphone class="mb-4 h-12 w-12 text-muted-foreground/50" />
					<h3 class="font-medium">{m['announcements.empty.sent']()}</h3>
					<p class="text-sm text-muted-foreground">{m['announcements.empty.sentDescription']()}</p>
				</div>
			{:else}
				<div class="space-y-3">
					{#each announcements as announcement (announcement.id)}
						<AnnouncementCard {announcement} onView={() => openViewDialog(announcement)} />
					{/each}
				</div>
			{/if}
		</Tabs.Content>
	</Tabs.Root>
</div>

<!-- Create/Edit Modal -->
<AnnouncementModal
	open={modalOpen}
	announcement={selectedAnnouncement}
	{organizationSlug}
	{events}
	{tiers}
	onClose={() => {
		modalOpen = false;
		selectedAnnouncement = null;
	}}
	onSuccess={handleModalSuccess}
/>

<!-- Delete Confirmation Dialog -->
{#if announcementToDelete}
	<Dialog
		open={deleteDialogOpen}
		onOpenChange={(open) => {
			if (!open) handleCancelDelete();
		}}
	>
		<DialogContent class="sm:max-w-[425px]">
			<DialogHeader>
				<DialogTitle>{m['announcements.confirm.delete']()}</DialogTitle>
				<DialogDescription>
					{m['announcements.confirm.deleteDescription']()}
				</DialogDescription>
			</DialogHeader>
			<div class="space-y-4 py-4">
				<div class="flex gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
					<div class="shrink-0">
						<AlertTriangle class="h-5 w-5 text-destructive" aria-hidden="true" />
					</div>
					<div class="flex-1 space-y-2">
						<p class="text-sm font-medium text-destructive">
							{announcementToDelete.title}
						</p>
					</div>
				</div>
				<div class="flex justify-end gap-2">
					<Button
						variant="outline"
						onclick={handleCancelDelete}
						disabled={deleteMutation.isPending}
					>
						{m['announcements.cancel']()}
					</Button>
					<Button variant="destructive" onclick={handleDelete} disabled={deleteMutation.isPending}>
						{#if deleteMutation.isPending}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						{/if}
						{m['announcements.delete']()}
					</Button>
				</div>
			</div>
		</DialogContent>
	</Dialog>
{/if}

<!-- Send Confirmation Dialog -->
{#if announcementToSend}
	<Dialog
		open={sendDialogOpen}
		onOpenChange={(open) => {
			if (!open) handleCancelSend();
		}}
	>
		<DialogContent class="sm:max-w-[425px]">
			<DialogHeader>
				<DialogTitle>{m['announcements.confirm.send']()}</DialogTitle>
				<DialogDescription>
					{m['announcements.confirm.sendDescription']()}
				</DialogDescription>
			</DialogHeader>
			<div class="space-y-4 py-4">
				<div class="flex gap-3 rounded-lg border border-primary/50 bg-primary/10 p-4">
					<div class="shrink-0">
						<Megaphone class="h-5 w-5 text-primary" aria-hidden="true" />
					</div>
					<div class="flex-1 space-y-2">
						<p class="text-sm font-medium">
							{announcementToSend.title}
						</p>
					</div>
				</div>
				<div class="flex justify-end gap-2">
					<Button variant="outline" onclick={handleCancelSend} disabled={sendMutation.isPending}>
						{m['announcements.cancel']()}
					</Button>
					<Button onclick={handleSend} disabled={sendMutation.isPending}>
						{#if sendMutation.isPending}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						{/if}
						{m['announcements.send']()}
					</Button>
				</div>
			</div>
		</DialogContent>
	</Dialog>
{/if}

<!-- View Announcement Dialog -->
<Dialog
	open={viewDialogOpen}
	onOpenChange={(open) => {
		if (!open) closeViewDialog();
	}}
>
	<DialogContent class="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
		<DialogHeader>
			<DialogTitle>
				{viewingAnnouncement?.title ?? m['announcements.view']()}
			</DialogTitle>
		</DialogHeader>
		{#if isLoadingView}
			<div class="flex items-center justify-center py-12">
				<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		{:else if viewingAnnouncement}
			<div class="space-y-4 py-4">
				<!-- Metadata -->
				<div class="flex flex-wrap gap-4 text-sm text-muted-foreground">
					{#if viewingAnnouncement.sent_at}
						<span
							>{m['announcements.card.sentAt']({
								date: formatRelativeTime(viewingAnnouncement.sent_at)
							})}</span
						>
					{:else}
						<span
							>{m['announcements.card.createdAt']({
								date: formatRelativeTime(viewingAnnouncement.created_at)
							})}</span
						>
					{/if}
					{#if viewingAnnouncement.event_name}
						<span
							>• {m['announcements.card.targetEvent']({
								name: viewingAnnouncement.event_name
							})}</span
						>
					{:else if viewingAnnouncement.target_staff_only}
						<span>• {m['announcements.card.targetStaff']()}</span>
					{:else if viewingAnnouncement.target_all_members}
						<span>• {m['announcements.card.targetAllMembers']()}</span>
					{/if}
					{#if viewingAnnouncement.recipient_count && viewingAnnouncement.recipient_count > 0}
						<span
							>• {m['announcements.card.recipients']({
								count: String(viewingAnnouncement.recipient_count)
							})}</span
						>
					{/if}
				</div>

				<!-- Body -->
				<MarkdownContent content={viewingAnnouncement.body} ariaLabel="Announcement content" />

				<!-- Close button -->
				<div class="flex justify-end pt-4">
					<Button variant="outline" onclick={closeViewDialog}>
						{m['orgAdmin.events.actions.close']()}
					</Button>
				</div>
			</div>
		{/if}
	</DialogContent>
</Dialog>
