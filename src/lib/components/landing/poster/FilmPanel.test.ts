import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FilmPanel from './FilmPanel.svelte';
import * as m from '$lib/paraglide/messages.js';
import * as runtime from '$lib/paraglide/runtime.js';

vi.mock('$lib/paraglide/runtime.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/paraglide/runtime.js')>();
	return { ...actual, getLocale: vi.fn(() => 'en') };
});

function getVideo(): HTMLVideoElement {
	const video = document.querySelector('video');
	if (!video) throw new Error('no <video> rendered');
	return video;
}

describe('FilmPanel', () => {
	let playSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		// jsdom does not implement media playback.
		playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
	});

	afterEach(() => {
		playSpy.mockRestore();
		vi.mocked(runtime.getLocale).mockReturnValue('en');
	});

	it('renders its heading at level 2 and the #film anchor the hero links to', () => {
		render(FilmPanel);
		expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
		expect(document.getElementById('film')).not.toBeNull();
	});

	it('fetches nothing until play: preload none, no native controls', () => {
		render(FilmPanel);
		const video = getVideo();
		expect(video).toHaveAttribute('preload', 'none');
		expect(video.controls).toBe(false);
		expect(video.getAttribute('src')).toBe(
			'https://public.letsrevel.io/videos/one-line-EN-1080p.mp4'
		);
	});

	it('ships captions in the film language', () => {
		render(FilmPanel);
		const track = getVideo().querySelector('track');
		expect(track).toHaveAttribute('kind', 'captions');
		expect(track).toHaveAttribute('srclang', 'en');
		expect(track).toHaveAttribute('src', '/film/one-line-en-v1.vtt');
	});

	it('serves the DE cut to the German locale', () => {
		vi.mocked(runtime.getLocale).mockReturnValue('de');
		render(FilmPanel);
		expect(getVideo().getAttribute('src')).toContain('one-line-DE-1080p.mp4');
		expect(screen.queryByText(m['home.poster.filmEnglishNote']())).not.toBeInTheDocument();
	});

	it('tells other locales the film is in English', () => {
		vi.mocked(runtime.getLocale).mockReturnValue('it');
		render(FilmPanel);
		expect(getVideo().getAttribute('src')).toContain('one-line-EN-1080p.mp4');
		expect(screen.getByText(m['home.poster.filmEnglishNote']())).toBeInTheDocument();
	});

	it('starts playback on click and hands over to the native controls', async () => {
		const user = userEvent.setup();
		render(FilmPanel);
		await user.click(screen.getByRole('button', { name: m['home.poster.filmPlayAria']() }));
		expect(playSpy).toHaveBeenCalledOnce();
		expect(getVideo().controls).toBe(true);
		expect(
			screen.queryByRole('button', { name: m['home.poster.filmPlayAria']() })
		).not.toBeInTheDocument();
	});
});
