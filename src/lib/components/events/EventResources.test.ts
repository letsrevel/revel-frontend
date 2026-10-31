import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import EventResources from './EventResources.svelte';
import type { AdditionalResourceSchema } from '$lib/api/generated/types.gen';

const linkResource: AdditionalResourceSchema = {
	id: 'r1',
	name: 'Venue map',
	resource_type: 'link',
	link: 'https://example.com/map'
};

describe('EventResources', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('opens link resources without exposing window.opener', async () => {
		const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
		render(EventResources, { resources: [linkResource] });

		await userEvent.click(screen.getByRole('button', { name: /open link/i }));

		expect(openSpy).toHaveBeenCalledWith(
			'https://example.com/map',
			'_blank',
			'noopener,noreferrer'
		);
	});

	it('opens file resources without exposing window.opener', async () => {
		const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
		render(EventResources, {
			resources: [
				{
					id: 'r2',
					name: 'Flyer',
					resource_type: 'file',
					file_url: 'https://cdn.example.com/f.pdf'
				}
			]
		});

		await userEvent.click(screen.getByRole('button', { name: /download file/i }));

		expect(openSpy).toHaveBeenCalledWith(
			'https://cdn.example.com/f.pdf',
			'_blank',
			'noopener,noreferrer'
		);
	});
});
