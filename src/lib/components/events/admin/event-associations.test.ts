import { describe, it, expect, vi, beforeEach } from 'vitest';

const { eventadmincoreAddTags, eventadmincoreRemoveTags } = vi.hoisted(() => ({
	eventadmincoreAddTags: vi.fn(),
	eventadmincoreRemoveTags: vi.fn()
}));

vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventadmincoreAddTags,
	eventadmincoreRemoveTags,
	organizationadminresourcesGetResource: vi.fn(),
	organizationadminresourcesUpdateResource: vi.fn()
}));

import { saveTagAssociations } from './event-associations';

describe('saveTagAssociations', () => {
	beforeEach(() => {
		eventadmincoreAddTags.mockReset().mockResolvedValue({});
		eventadmincoreRemoveTags.mockReset().mockResolvedValue({});
	});

	it('sends neither add nor remove when only the letter case changes', async () => {
		const snapshot = await saveTagAssociations({
			eventId: 'e1',
			currentTags: ['fun'],
			initialTags: ['Fun']
		});

		expect(eventadmincoreAddTags).not.toHaveBeenCalled();
		expect(eventadmincoreRemoveTags).not.toHaveBeenCalled();
		expect(snapshot).toEqual(['fun']);
	});

	it('adds new tags and removes deleted tags', async () => {
		await saveTagAssociations({
			eventId: 'e1',
			currentTags: ['keep', 'new'],
			initialTags: ['keep', 'old']
		});

		expect(eventadmincoreAddTags).toHaveBeenCalledWith({
			path: { event_id: 'e1' },
			body: { tags: ['new'] }
		});
		expect(eventadmincoreRemoveTags).toHaveBeenCalledWith({
			path: { event_id: 'e1' },
			body: { tags: ['old'] }
		});
	});
});
