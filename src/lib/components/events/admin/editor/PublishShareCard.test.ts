import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import PublishShareCard from './PublishShareCard.svelte';

const base = {
	eventName: 'Rooftop & Beats',
	eventUrl: 'https://letsrevel.io/events/acme/rooftop?x=1',
	onPublish: vi.fn()
};

describe('PublishShareCard', () => {
	it('draft: renders the publish CTA and calls the handler', async () => {
		const onPublish = vi.fn();
		render(PublishShareCard, { props: { ...base, status: 'draft', onPublish } });
		await userEvent.click(screen.getByRole('button', { name: 'Publish event' }));
		expect(onPublish).toHaveBeenCalledOnce();
		expect(screen.queryByRole('link', { name: 'Share on WhatsApp' })).toBeNull();
	});

	it('draft: shows a preview link only when given', () => {
		const { unmount } = render(PublishShareCard, { props: { ...base, status: 'draft' } });
		expect(screen.queryByRole('link', { name: 'Preview' })).toBeNull();
		unmount();
		render(PublishShareCard, {
			props: { ...base, status: 'draft', previewHref: '/events/acme/rooftop' }
		});
		expect(screen.getByRole('link', { name: 'Preview' }).getAttribute('href')).toBe(
			'/events/acme/rooftop'
		);
	});

	it('open: renders encoded share links and the copy field', () => {
		render(PublishShareCard, { props: { ...base, status: 'open' } });
		const name = encodeURIComponent(base.eventName);
		const url = encodeURIComponent(base.eventUrl);
		const wa = screen.getByRole('link', { name: 'Share on WhatsApp' });
		expect(wa.getAttribute('href')).toBe(
			`https://wa.me/?text=${encodeURIComponent(`${base.eventName} ${base.eventUrl}`)}`
		);
		const tg = screen.getByRole('link', { name: 'Share on Telegram' });
		expect(tg.getAttribute('href')).toBe(`https://t.me/share/url?url=${url}&text=${name}`);
		const mail = screen.getByRole('link', { name: 'Share by email' });
		expect(mail.getAttribute('href')).toBe(`mailto:?subject=${name}&body=${url}`);
		for (const a of [wa, tg, mail]) {
			expect(a.getAttribute('target')).toBe('_blank');
			expect(a.getAttribute('rel')).toBe('noopener noreferrer');
		}
		expect((screen.getByLabelText('Event link') as HTMLInputElement).value).toBe(base.eventUrl);
	});

	it('open: can be dismissed for the session', async () => {
		render(PublishShareCard, { props: { ...base, status: 'open' } });
		await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
		expect(screen.queryByTestId('publish-share-card')).toBeNull();
	});

	it.each(['closed', 'cancelled'])('%s: renders nothing', (status) => {
		render(PublishShareCard, { props: { ...base, status } });
		expect(screen.queryByTestId('publish-share-card')).toBeNull();
	});
});
