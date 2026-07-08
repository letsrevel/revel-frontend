import * as m from '$lib/paraglide/messages.js';
import { createMutation } from '@tanstack/svelte-query';
import {
	eventadmincoreUploadLogo,
	eventadmincoreUploadCoverArt,
	eventadmincoreDeleteLogo,
	eventadmincoreDeleteCoverArt
} from '$lib/api/generated/sdk.gen';

/**
 * Create the four event image mutations (upload/delete logo & cover art).
 *
 * These mutations are pure with respect to component state — their
 * `mutationFn`s take their arguments explicitly and touch no reactive
 * component state — so the identical copies previously duplicated in
 * EventWizard and EventEditor are hoisted here verbatim. Call this once at
 * component init (it uses runes) and destructure the returned mutations.
 */
export function createEventImageMutations() {
	const uploadLogoMutation = createMutation(() => ({
		mutationFn: async ({ id, file }: { id: string; file: File }) => {
			const response = await eventadmincoreUploadLogo({
				path: { event_id: id },
				body: { logo: file }
			});
			if (!response.data) {
				throw new Error(m['eventWizard.error_failedToUploadLogo']());
			}
			return response.data;
		}
	}));

	const uploadCoverArtMutation = createMutation(() => ({
		mutationFn: async ({ id, file }: { id: string; file: File }) => {
			const response = await eventadmincoreUploadCoverArt({
				path: { event_id: id },
				body: { cover_art: file }
			});
			if (!response.data) {
				throw new Error(m['eventWizard.error_failedToUploadCoverArt']());
			}
			return response.data;
		}
	}));

	const deleteLogoMutation = createMutation(() => ({
		mutationFn: async (id: string) => {
			const response = await eventadmincoreDeleteLogo({
				path: { event_id: id }
			});
			if (response.error) {
				throw new Error(m['eventWizard.error_failedToDeleteLogo']());
			}
			return response.data;
		}
	}));

	const deleteCoverArtMutation = createMutation(() => ({
		mutationFn: async (id: string) => {
			const response = await eventadmincoreDeleteCoverArt({
				path: { event_id: id }
			});
			if (response.error) {
				throw new Error(m['eventWizard.error_failedToDeleteCoverArt']());
			}
			return response.data;
		}
	}));

	return {
		uploadLogoMutation,
		uploadCoverArtMutation,
		deleteLogoMutation,
		deleteCoverArtMutation
	};
}
