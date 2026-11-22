import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TagsFilter from './TagsFilter.svelte';

const { tagListTags } = vi.hoisted(() => ({ tagListTags: vi.fn() }));
vi.mock('$lib/api', () => ({ tagListTags }));

const TAGS = Array.from({ length: 20 }, (_, i) => `tag-${i + 1}`);

function mockTags(names: string[] = TAGS): void {
	tagListTags.mockResolvedValue({ data: { results: names.map((name) => ({ name })) } });
}

describe('TagsFilter show more / fewer', () => {
	beforeEach(() => {
		tagListTags.mockReset();
	});

	it('shows only the first 12 tags and a toggle for the rest', async () => {
		mockTags();
		render(TagsFilter, { props: { selectedTags: [], onToggleTag: vi.fn() } });

		expect(await screen.findByRole('button', { name: /Add tag-1 filter/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Add tag-12 filter/ })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /Add tag-13 filter/ })).not.toBeInTheDocument();

		const toggle = screen.getByRole('button', { name: 'Show 8 more tags' });
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(toggle).toHaveAttribute('aria-controls');
	});

	it('reveals every tag, then collapses again', async () => {
		mockTags();
		const user = userEvent.setup();
		render(TagsFilter, { props: { selectedTags: [], onToggleTag: vi.fn() } });

		await user.click(await screen.findByRole('button', { name: 'Show 8 more tags' }));
		expect(screen.getByRole('button', { name: /Add tag-20 filter/ })).toBeInTheDocument();

		const fewer = screen.getByRole('button', { name: 'Show fewer tags' });
		expect(fewer).toHaveAttribute('aria-expanded', 'true');
		const listId = fewer.getAttribute('aria-controls') ?? '';
		expect(document.getElementById(listId)).toContainElement(
			screen.getByRole('button', { name: /Add tag-20 filter/ })
		);

		await user.click(fewer);
		expect(screen.queryByRole('button', { name: /Add tag-20 filter/ })).not.toBeInTheDocument();
	});

	it('keeps a selected tag visible when it is beyond the first 12', async () => {
		mockTags();
		render(TagsFilter, { props: { selectedTags: ['tag-18'], onToggleTag: vi.fn() } });

		expect(await screen.findByRole('button', { name: /Remove tag-18 filter/ })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /Add tag-17 filter/ })).not.toBeInTheDocument();
		// Only 7 are hidden now, since tag-18 is already visible.
		expect(screen.getByRole('button', { name: 'Show 7 more tags' })).toBeInTheDocument();
	});

	it('shows no toggle when there are 12 tags or fewer', async () => {
		mockTags(TAGS.slice(0, 12));
		render(TagsFilter, { props: { selectedTags: [], onToggleTag: vi.fn() } });

		await screen.findByRole('button', { name: /Add tag-12 filter/ });
		expect(screen.queryByRole('button', { name: /more tags|fewer tags/ })).not.toBeInTheDocument();
	});

	it('keeps a deselected tag beyond the limit mounted and focused', async () => {
		mockTags();
		const user = userEvent.setup();
		const selected = ['tag-15'];
		const onToggleTag = vi.fn();
		const { rerender } = render(TagsFilter, {
			props: { selectedTags: selected, onToggleTag }
		});

		const chip = await screen.findByRole('button', { name: /Remove tag-15 filter/ });
		await user.click(chip);
		expect(onToggleTag).toHaveBeenCalledWith('tag-15');

		await rerender({ selectedTags: [], onToggleTag });
		const same = screen.getByRole('button', { name: /Add tag-15 filter/ });
		expect(same).toBe(chip);
		expect(same).toHaveFocus();
	});

	it('moves focus to the last tag when collapsing removes the toggle', async () => {
		mockTags(TAGS.slice(0, 13));
		const user = userEvent.setup();
		const onToggleTag = vi.fn();
		const { rerender } = render(TagsFilter, { props: { selectedTags: [], onToggleTag } });

		await user.click(await screen.findByRole('button', { name: /Show 1 more/ }));
		// Select the 13th tag while expanded.
		await rerender({ selectedTags: ['tag-13'], onToggleTag });

		const fewer = screen.getByRole('button', { name: 'Show fewer tags' });
		fewer.focus();
		await user.keyboard('{Enter}');

		// The 13th tag is selected, so all 13 stay visible and the toggle is gone.
		expect(screen.queryByRole('button', { name: /more tags|fewer tags/ })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Remove tag-13 filter/ })).toHaveFocus();
	});

	it('keeps focus on the toggle when it survives collapsing', async () => {
		mockTags();
		const user = userEvent.setup();
		render(TagsFilter, { props: { selectedTags: [], onToggleTag: vi.fn() } });

		await user.click(await screen.findByRole('button', { name: 'Show 8 more tags' }));
		const fewer = screen.getByRole('button', { name: 'Show fewer tags' });
		await user.click(fewer);

		const more = screen.getByRole('button', { name: 'Show 8 more tags' });
		expect(more).toBe(fewer);
		expect(more).toHaveFocus();
	});
});
