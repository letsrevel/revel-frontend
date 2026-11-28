import { render, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import SeriesSettingsDialog from './SeriesSettingsDialog.svelte';
import type { EventSeriesRecurrenceDetailSchema } from '$lib/api/generated/types.gen';

type TagsInputProps = { tags: string[]; onUpdate: (data: { tags: string[] }) => void };

const mocks = vi.hoisted(() => ({
	getSeries: vi.fn(),
	addTags: vi.fn(),
	removeTags: vi.fn(),
	tagsInput: { props: null as unknown }
}));

vi.mock('$lib/api/generated/sdk.gen', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/generated/sdk.gen')>()),
	eventseriesGetEventSeries: mocks.getSeries,
	eventseriesadminAddTags: mocks.addTags,
	eventseriesadminRemoveTags: mocks.removeTags
}));

// The real tag input refuses a case-only duplicate before it reports, so it
// cannot produce a case-only change. A Svelte 5 component is a plain function
// `(anchor, props)`: this stub renders nothing and keeps the props so the test
// can report any tag list to the dialog's handler.
vi.mock('$lib/components/events/admin/DetailsStepTagsInput.svelte', () => ({
	default: (_anchor: unknown, props: unknown): void => {
		mocks.tagsInput.props = props;
	}
}));

function currentProps(): TagsInputProps {
	return mocks.tagsInput.props as TagsInputProps;
}

const series = {
	id: 'ser_1',
	name: 'Weekly Run Club',
	slug: 'weekly-run-club',
	description: null
} as unknown as EventSeriesRecurrenceDetailSchema;

function renderDialog(): void {
	render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: SeriesSettingsDialog,
			componentProps: {
				open: true,
				series,
				organizationSlug: 'org',
				accessToken: 'token',
				onClose: vi.fn()
			}
		}
	});
}

describe('SeriesSettingsDialog tag diff', () => {
	beforeEach(() => {
		mocks.tagsInput.props = null;
		mocks.getSeries.mockReset().mockResolvedValue({ data: { id: 'ser_1', tags: ['Fun'] } });
		mocks.addTags.mockReset().mockResolvedValue({ data: {} });
		mocks.removeTags.mockReset().mockResolvedValue({ data: {} });
	});

	async function ready(): Promise<void> {
		renderDialog();
		await waitFor(() => expect(currentProps()?.tags).toEqual(['Fun']));
	}

	it('treats a change in letter case only as no change', async () => {
		await ready();

		currentProps().onUpdate({ tags: ['fun'] });
		// Let any mutation start before asserting that none did.
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(mocks.addTags).not.toHaveBeenCalled();
		expect(mocks.removeTags).not.toHaveBeenCalled();
	});

	it('adds only the new tag and keeps the stored casing of a case-matching one', async () => {
		await ready();

		currentProps().onUpdate({ tags: ['fun', 'new'] });

		await waitFor(() => expect(mocks.addTags).toHaveBeenCalledTimes(1));
		expect(mocks.addTags.mock.calls[0][0].body).toEqual({ tags: ['new'] });
		expect(mocks.removeTags).not.toHaveBeenCalled();
	});

	it('removes a tag that is gone from the list', async () => {
		await ready();

		currentProps().onUpdate({ tags: [] });

		await waitFor(() => expect(mocks.removeTags).toHaveBeenCalledTimes(1));
		expect(mocks.removeTags.mock.calls[0][0].body).toEqual({ tags: ['Fun'] });
		expect(mocks.addTags).not.toHaveBeenCalled();
	});
});
