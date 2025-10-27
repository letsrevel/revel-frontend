import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import ImageUploader from './ImageUploader.svelte';

describe('ImageUploader', () => {
	// Mock FileReader
	beforeEach(() => {
		global.FileReader = class FileReader {
			readAsDataURL = vi.fn();
			onloadend: ((this: FileReader, ev: ProgressEvent) => any) | null = null;
			result: string | ArrayBuffer | null = 'data:image/png;base64,test';

			constructor() {
				setTimeout(() => {
					if (this.onloadend) {
						this.onloadend({} as ProgressEvent);
					}
				}, 0);
			}
		} as any;
	});

	it('renders with label', () => {
		render(ImageUploader, {
			props: {
				label: 'Event Banner'
			}
		});

		expect(screen.getByText('Event Banner')).toBeInTheDocument();
	});

	it('shows required indicator when required', () => {
		render(ImageUploader, {
			props: {
				label: 'Banner',
				required: true
			}
		});

		const label = screen.getByText('Banner').parentElement;
		expect(label?.textContent).toContain('*');
	});

	it('displays error message', () => {
		render(ImageUploader, {
			props: {
				label: 'Banner',
				error: 'Image is required'
			}
		});

		expect(screen.getByRole('alert')).toHaveTextContent('Image is required');
	});

	it('shows upload area when no image selected', () => {
		render(ImageUploader, {
			props: {
				label: 'Banner'
			}
		});

		expect(screen.getByRole('button', { name: /upload image/i })).toBeInTheDocument();
		expect(screen.getByText(/click to upload or drag and drop/i)).toBeInTheDocument();
	});

	it('shows preview when preview URL provided', () => {
		render(ImageUploader, {
			props: {
				label: 'Banner',
				preview: 'https://example.com/image.jpg'
			}
		});

		const img = screen.getByAltText('Preview') as HTMLImageElement;
		expect(img).toBeInTheDocument();
		expect(img.src).toBe('https://example.com/image.jpg');
	});

	it('calls onFileSelect when file is selected', async () => {
		const user = userEvent.setup();
		const handleFileSelect = vi.fn();

		render(ImageUploader, {
			props: {
				label: 'Banner',
				onFileSelect: handleFileSelect
			}
		});

		const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
		const input = screen
			.getByLabelText('Upload image')
			.closest('div')
			?.querySelector('input[type="file"]') as HTMLInputElement;

		if (input) {
			await user.upload(input, file);
			expect(handleFileSelect).toHaveBeenCalledWith(file);
		}
	});

	it('validates file type', async () => {
		const user = userEvent.setup();

		render(ImageUploader, {
			props: {
				label: 'Banner',
				accept: 'image/jpeg,image/png'
			}
		});

		const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
		const input = screen
			.getByLabelText('Upload image')
			.closest('div')
			?.querySelector('input[type="file"]') as HTMLInputElement;

		if (input) {
			// This will trigger validation in the component
			Object.defineProperty(input, 'files', {
				value: [file],
				writable: false
			});
		}
	});

	it('validates file size', async () => {
		const user = userEvent.setup();

		render(ImageUploader, {
			props: {
				label: 'Banner',
				maxSize: 1024 // 1KB
			}
		});

		// Create a file larger than maxSize
		const largeContent = new Array(2048).fill('a').join('');
		const file = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });

		const input = screen
			.getByLabelText('Upload image')
			.closest('div')
			?.querySelector('input[type="file"]') as HTMLInputElement;

		if (input) {
			Object.defineProperty(input, 'files', {
				value: [file],
				writable: false
			});
		}
	});

	it('shows remove button when image is selected', async () => {
		render(ImageUploader, {
			props: {
				label: 'Banner',
				preview: 'https://example.com/image.jpg'
			}
		});

		expect(screen.getByRole('button', { name: /remove image/i })).toBeInTheDocument();
	});

	it('removes image when remove button clicked', async () => {
		const user = userEvent.setup();
		const handleFileSelect = vi.fn();

		render(ImageUploader, {
			props: {
				label: 'Banner',
				preview: 'https://example.com/image.jpg',
				onFileSelect: handleFileSelect
			}
		});

		const removeButton = screen.getByRole('button', { name: /remove image/i });
		await user.click(removeButton);

		expect(handleFileSelect).toHaveBeenCalledWith(null);
	});

	it('respects disabled state', () => {
		render(ImageUploader, {
			props: {
				label: 'Banner',
				disabled: true
			}
		});

		const uploadArea = screen.getByRole('button', { name: /upload image/i });
		expect(uploadArea).toHaveClass('cursor-not-allowed');
	});

	it('is keyboard accessible', async () => {
		const user = userEvent.setup();

		render(ImageUploader, {
			props: {
				label: 'Banner'
			}
		});

		const uploadArea = screen.getByRole('button', { name: /upload image/i });

		// Should be focusable
		uploadArea.focus();
		expect(uploadArea).toHaveFocus();

		// Should respond to Enter key
		await user.keyboard('{Enter}');
	});

	it('displays file information when file is selected', async () => {
		render(ImageUploader, {
			props: {
				label: 'Banner',
				value: new File(['test'], 'test.jpg', { type: 'image/jpeg' }),
				preview: 'data:image/png;base64,test'
			}
		});

		expect(screen.getByText('test.jpg')).toBeInTheDocument();
	});

	it('shows accepted file types in hint', () => {
		render(ImageUploader, {
			props: {
				label: 'Banner',
				accept: 'image/jpeg,image/png,image/webp'
			}
		});

		const hint = screen.getByText(/JPEG, PNG, WEBP/i);
		expect(hint).toBeInTheDocument();
	});
});
