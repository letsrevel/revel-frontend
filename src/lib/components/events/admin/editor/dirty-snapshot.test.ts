import { describe, it, expect } from 'vitest';
import { buildDirtySnapshot, type DirtySnapshotInput } from './dirty-snapshot';

const base = (): DirtySnapshotInput => ({
	formData: { name: 'Gala', start: '2026-07-26T19:00', tags: ['a'] },
	scheduleRows: [{ title: 'Doors', time: '19:00' }],
	resourceIds: ['r2', 'r1'],
	logoFile: null,
	coverArtFile: null,
	deleteLogo: false,
	deleteCoverArt: false
});

describe('buildDirtySnapshot', () => {
	it('is stable for identical input regardless of key order', () => {
		const a = buildDirtySnapshot(base());
		const b = buildDirtySnapshot({
			...base(),
			formData: { tags: ['a'], start: '2026-07-26T19:00', name: 'Gala' }
		});
		expect(a).toBe(b);
	});

	it('ignores resource id order', () => {
		expect(buildDirtySnapshot(base())).toBe(
			buildDirtySnapshot({ ...base(), resourceIds: ['r1', 'r2'] })
		);
	});

	it('changes when a field, schedule row or resource changes', () => {
		const a = buildDirtySnapshot(base());
		expect(
			buildDirtySnapshot({ ...base(), formData: { ...(base().formData as object), name: 'X' } })
		).not.toBe(a);
		expect(buildDirtySnapshot({ ...base(), scheduleRows: [] })).not.toBe(a);
		expect(buildDirtySnapshot({ ...base(), resourceIds: ['r1'] })).not.toBe(a);
	});

	it('tracks pending image state by presence and delete flags', () => {
		const a = buildDirtySnapshot(base());
		const file = new File(['x'], 'x.png');
		expect(buildDirtySnapshot({ ...base(), logoFile: file })).not.toBe(a);
		expect(buildDirtySnapshot({ ...base(), coverArtFile: file })).not.toBe(a);
		expect(buildDirtySnapshot({ ...base(), deleteLogo: true })).not.toBe(a);
		expect(buildDirtySnapshot({ ...base(), deleteCoverArt: true })).not.toBe(a);
	});
});
