import { describe, it, expect } from 'vitest';
import { cleanTagName, tagKey, hasTag, toggleTag, dedupeTags, diffTags } from './tags';

describe('cleanTagName', () => {
	it('trims and strips every leading #', () => {
		expect(cleanTagName('##fun ')).toBe('fun');
		expect(cleanTagName('  #fun')).toBe('fun');
	});

	it('returns an empty string for a bare #', () => {
		expect(cleanTagName('#')).toBe('');
	});

	it('keeps the letter case', () => {
		expect(cleanTagName('#Fun')).toBe('Fun');
	});
});

describe('tagKey', () => {
	it('folds case and cleans', () => {
		expect(tagKey('#Fun ')).toBe('fun');
		expect(tagKey('FUN')).toBe(tagKey('fun'));
	});

	// Documentation only: toLowerCase, not toLocaleLowerCase, so the key does not
	// depend on the UI language (Turkish dotted/dotless I).
	it('folds INFO to info', () => {
		expect(tagKey('INFO')).toBe('info');
	});
});

describe('hasTag', () => {
	it('matches regardless of case and leading #', () => {
		expect(hasTag(['Fun', 'x'], 'fun')).toBe(true);
		expect(hasTag(['fun'], '#FUN')).toBe(true);
	});

	it('is false when no tag matches', () => {
		expect(hasTag(['Fun'], 'party')).toBe(false);
		expect(hasTag([], 'fun')).toBe(false);
	});
});

describe('toggleTag', () => {
	it('removes every case variant of the tag', () => {
		expect(toggleTag(['fun', 'Fun'], 'FUN')).toEqual([]);
	});

	it('adds to an empty list', () => {
		expect(toggleTag([], 'Fun')).toEqual(['Fun']);
	});

	it('appends the name with the casing it was given', () => {
		expect(toggleTag(['x'], 'Fun')).toEqual(['x', 'Fun']);
	});

	it('removes a stored tag when given the #-prefixed name', () => {
		expect(toggleTag(['Fun', 'x'], '#fun')).toEqual(['x']);
	});

	it('does not change the input list', () => {
		const list = ['Fun'];
		toggleTag(list, 'fun');
		expect(list).toEqual(['Fun']);
	});
});

describe('dedupeTags', () => {
	it('keeps the first tag of each key', () => {
		expect(dedupeTags(['fun', 'Fun', 'FUN', 'x'])).toEqual(['fun', 'x']);
	});

	it('drops names that clean to empty', () => {
		expect(dedupeTags(['', '#', ' ', 'a'])).toEqual(['a']);
	});
});

describe('diffTags', () => {
	it('treats a change of letter case only as no change', () => {
		expect(diffTags(['Fun'], ['fun'])).toEqual({ added: [], removed: [] });
	});

	it('reports a real add', () => {
		expect(diffTags(['a'], ['a', 'b'])).toEqual({ added: ['b'], removed: [] });
	});

	it('reports a real remove', () => {
		expect(diffTags(['a', 'b'], ['a'])).toEqual({ added: [], removed: ['b'] });
	});
});
