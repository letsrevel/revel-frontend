import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const apiUrl = process.env.PUBLIC_API_URL || 'https://api.letsrevel.io';
const isDev = process.env.NODE_ENV !== 'production';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

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

		// Content Security Policy — enforced
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'style-src': ['self', 'unsafe-inline'], // Svelte transitions create inline <style>
				'img-src': ['self', apiUrl, 'data:', 'blob:'],
				'font-src': ['self', 'data:'],
				'connect-src': [
					'self',
					apiUrl,
					'https://api.github.com',
					...(isDev ? ['http://localhost:*', 'ws://localhost:*'] : [])
				],
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
	}
};

export default config;
