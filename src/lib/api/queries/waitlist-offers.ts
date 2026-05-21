import type { QueryClient } from '@tanstack/svelte-query';
import {
	eventadminwaitlistoffersGetWaitlistSettings,
	eventadminwaitlistoffersUpdateWaitlistSettings,
	eventadminwaitlistoffersListWaitlistOffers,
	eventadminwaitlistoffersCreateWaitlistOffer,
	eventadminwaitlistoffersRevokeWaitlistOffer,
	eventadminwaitlistoffersReactivateWaitlistOffer
} from '$lib/api';
import type {
	WaitlistSettingsSchema,
	WaitlistSettingsUpdateSchema,
	WaitlistOfferSchema,
	WaitlistOfferStatus,
	WaitlistOfferCreateSchema,
	WaitlistOfferReactivateSchema,
	PaginatedResponseSchemaWaitlistOfferSchema
} from '$lib/api/generated/types.gen';

type EventId = string;

export const waitlistOfferQueryKeys = {
	all: ['waitlist-offers'] as const,
	settings: (eventId: EventId) => ['waitlist-settings', eventId] as const,
	offers: (eventId: EventId, opts: { status?: WaitlistOfferStatus | null; page?: number } = {}) =>
		['waitlist-offers', eventId, { status: opts.status ?? null, page: opts.page ?? 1 }] as const
} as const;

// Build queryFn closures that pass the access token at call time so token
// rotation in `authStore` is picked up by every refetch.
type AuthGetter = () => string | null | undefined;

function authHeaders(token: string | null | undefined): { Authorization: string } | undefined {
	if (!token) return undefined;
	return { Authorization: `Bearer ${token}` };
}

export function createWaitlistSettingsQueryOptions(eventId: EventId, getAccessToken: AuthGetter) {
	return () => ({
		queryKey: waitlistOfferQueryKeys.settings(eventId),
		queryFn: async (): Promise<WaitlistSettingsSchema> => {
			const response = await eventadminwaitlistoffersGetWaitlistSettings({
				path: { event_id: eventId },
				headers: authHeaders(getAccessToken())
			});
			if (response.error || !response.data) {
				throw new Error('Failed to load waitlist settings');
			}
			return response.data;
		}
	});
}

export function createUpdateWaitlistSettingsMutationOptions(
	eventId: EventId,
	getAccessToken: AuthGetter,
	queryClient: QueryClient
) {
	return () => ({
		mutationFn: async (body: WaitlistSettingsUpdateSchema): Promise<WaitlistSettingsSchema> => {
			const response = await eventadminwaitlistoffersUpdateWaitlistSettings({
				path: { event_id: eventId },
				body,
				headers: authHeaders(getAccessToken())
			});
			if (response.error || !response.data) {
				throw response.error ?? new Error('Failed to update waitlist settings');
			}
			return response.data;
		},
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: waitlistOfferQueryKeys.settings(eventId) }),
				queryClient.invalidateQueries({ queryKey: ['event', eventId], exact: false })
			]);
		}
	});
}

export function createWaitlistOffersQueryOptions(
	eventId: EventId,
	getAccessToken: AuthGetter,
	getParams: () => { status?: WaitlistOfferStatus | null; page?: number }
) {
	return () => {
		const params = getParams();
		return {
			queryKey: waitlistOfferQueryKeys.offers(eventId, params),
			queryFn: async (): Promise<PaginatedResponseSchemaWaitlistOfferSchema> => {
				const response = await eventadminwaitlistoffersListWaitlistOffers({
					path: { event_id: eventId },
					query: {
						status: params.status ?? undefined,
						page: params.page ?? 1
					},
					headers: authHeaders(getAccessToken())
				});
				if (response.error || !response.data) {
					throw new Error('Failed to load waitlist offers');
				}
				return response.data;
			}
		};
	};
}

async function invalidateOffersAndEntries(
	queryClient: QueryClient,
	eventId: EventId
): Promise<void> {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: ['waitlist-offers', eventId], exact: false }),
		queryClient.invalidateQueries({ queryKey: ['waitlist', eventId], exact: false }),
		queryClient.invalidateQueries({ queryKey: ['event', eventId], exact: false }),
		queryClient.invalidateQueries({ queryKey: ['my-status', eventId], exact: false }),
		queryClient.invalidateQueries({ queryKey: ['event-status', eventId], exact: false })
	]);
}

export function createCreateWaitlistOfferMutationOptions(
	eventId: EventId,
	getAccessToken: AuthGetter,
	queryClient: QueryClient
) {
	return () => ({
		mutationFn: async (body: WaitlistOfferCreateSchema): Promise<WaitlistOfferSchema> => {
			const response = await eventadminwaitlistoffersCreateWaitlistOffer({
				path: { event_id: eventId },
				body,
				headers: authHeaders(getAccessToken())
			});
			if (response.error || !response.data) {
				throw response.error ?? new Error('Failed to create waitlist offer');
			}
			return response.data;
		},
		onSuccess: () => invalidateOffersAndEntries(queryClient, eventId)
	});
}

export function createRevokeWaitlistOfferMutationOptions(
	eventId: EventId,
	getAccessToken: AuthGetter,
	queryClient: QueryClient
) {
	return () => ({
		mutationFn: async (offerId: string): Promise<WaitlistOfferSchema> => {
			const response = await eventadminwaitlistoffersRevokeWaitlistOffer({
				path: { event_id: eventId, offer_id: offerId },
				headers: authHeaders(getAccessToken())
			});
			if (response.error || !response.data) {
				throw response.error ?? new Error('Failed to revoke waitlist offer');
			}
			return response.data;
		},
		onSuccess: () => invalidateOffersAndEntries(queryClient, eventId)
	});
}

export function createReactivateWaitlistOfferMutationOptions(
	eventId: EventId,
	getAccessToken: AuthGetter,
	queryClient: QueryClient
) {
	return () => ({
		mutationFn: async (args: {
			offerId: string;
			body?: WaitlistOfferReactivateSchema | null;
		}): Promise<WaitlistOfferSchema> => {
			const response = await eventadminwaitlistoffersReactivateWaitlistOffer({
				path: { event_id: eventId, offer_id: args.offerId },
				body: args.body ?? undefined,
				headers: authHeaders(getAccessToken())
			});
			if (response.error || !response.data) {
				throw response.error ?? new Error('Failed to reactivate waitlist offer');
			}
			return response.data;
		},
		onSuccess: () => invalidateOffersAndEntries(queryClient, eventId)
	});
}
