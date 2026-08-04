import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
	it('merges conflicting stock utilities, last one winning', () => {
		expect(cn('p-2', 'p-4')).toBe('p-4');
	});

	it('knows shadow-poster belongs to the shadow group', () => {
		// Without extendTailwindMerge this returned "shadow-poster shadow-sm"
		// and stylesheet order — not the caller — decided the winner.
		expect(cn('shadow-poster', 'shadow-sm')).toBe('shadow-sm');
	});

	it('lets a call site cancel the Card/Dialog default shadow', () => {
		expect(cn('shadow-poster', 'shadow-none')).toBe('shadow-none');
		expect(cn('shadow-poster-lg', 'shadow-none')).toBe('shadow-none');
	});

	it('lets shadow-poster win when it comes last', () => {
		expect(cn('shadow-sm', 'shadow-poster')).toBe('shadow-poster');
		expect(cn('shadow-poster', 'shadow-poster-lg')).toBe('shadow-poster-lg');
	});

	it('keeps hover: and base shadows separate (different modifiers)', () => {
		expect(cn('shadow-poster', 'hover:shadow-lg')).toBe('shadow-poster hover:shadow-lg');
		expect(cn('hover:shadow-poster', 'hover:shadow-lg')).toBe('hover:shadow-lg');
	});

	it('does not disturb unrelated classes', () => {
		expect(cn('rounded-lg', 'shadow-poster', 'border-2')).toBe('rounded-lg shadow-poster border-2');
	});
});
