// src/lib/components/common/ImageCropperModal.test.ts
import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ImageCropperModal from './ImageCropperModal.svelte';

// svelte-easy-crop needs layout APIs jsdom lacks; stub it to a marker element.
vi.mock('svelte-easy-crop', async () => ({
	default: (await import('./__mocks__/CropperStub.svelte')).default
}));

describe('ImageCropperModal', () => {
	beforeEach(() => {
		global.URL.createObjectURL = vi.fn(() => 'blob:mock');
		global.URL.revokeObjectURL = vi.fn();
	});

	it('renders the dialog with save and cancel actions', async () => {
		const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
		render(ImageCropperModal, {
			props: { file, aspectRatio: 1, shape: 'round', onSave: vi.fn(), onCancel: vi.fn() }
		});
		expect(await screen.findByRole('dialog')).toBeInTheDocument();
		expect(screen.getAllByRole('button', { name: /cancel/i })[0]).toBeInTheDocument();
	});

	it('calls onCancel when the close button is clicked', async () => {
		const onCancel = vi.fn();
		const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
		render(ImageCropperModal, {
			props: { file, onSave: vi.fn(), onCancel }
		});
		(await screen.findAllByRole('button', { name: /cancel/i }))[0].click();
		expect(onCancel).toHaveBeenCalled();
	});
});
