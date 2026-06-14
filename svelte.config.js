import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const isDev = process.env.NODE_ENV !== 'production';

// NOTE (#396): the backend API origin is configured at RUNTIME (PUBLIC_API_URL via
// $env/dynamic/public), so it cannot be baked into the CSP here at build time.
// The runtime origin is appended to the API-dependent directives (img-src,
// media-src, connect-src) per response in src/hooks.server.ts (handleCsp).

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	// `state_referenced_locally` fires ~260 times across ~60 files for the
	// intentional "initialize local state from a prop" pattern, drowning out real
	// warnings in build logs. Silenced here; every other compiler warning still surfaces.
	onwarn: (warning, handler) => {
		if (warning.code === 'state_referenced_locally') return;
		handler(warning);
	},

	kit: {
		// Using adapter-node for Docker/production deployment
		// Builds a standalone Node.js server
		adapter: adapter({
			out: 'build',
			precompress: false
		}),

		alias: {
			$lib: 'src/lib',
			$components: 'src/lib/components',
			$utils: 'src/lib/utils',
			$stores: 'src/lib/stores',
			$api: 'src/lib/api'
		},

		// Content Security Policy — only enforced in production
		// In dev, Vite's HMR injects inline scripts without the CSP nonce, which breaks the page
		...(isDev
			? {}
			: {
					csp: {
						mode: 'auto',
						directives: {
							'default-src': ['self'],
							'script-src': ['self'],
							'style-src': ['self', 'unsafe-inline'], // Svelte transitions create inline <style>
							// The runtime API origin is appended to img-src/media-src/connect-src
							// in hooks.server.ts (handleCsp) — see #396.
							'img-src': ['self', 'data:', 'blob:'],
							'media-src': ['self', 'blob:'],
							'font-src': ['self', 'data:'],
							'connect-src': ['self', 'https://api.github.com'],
							'frame-src': [
								'https://www.google.com',
								'https://google.com',
								'https://maps.google.com',
								'https://www.openstreetmap.org',
								'https://openstreetmap.org',
								'https://www.bing.com',
								'https://bing.com',
								'https://maps.app.goo.gl',
								'https://goo.gl',
								'https://yandex.com',
								'https://yandex.ru',
								'https://map.baidu.com'
							],
							'manifest-src': ['self'],
							'base-uri': ['self'],
							'form-action': ['self'],
							'frame-ancestors': ['none'],
							'object-src': ['none']
						}
					}
				})
	}
};

export default config;
