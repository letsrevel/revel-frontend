module.exports = {
	ci: {
		collect: {
			startServerCommand: 'pnpm preview --port 4173',
			startServerReadyPattern: 'preview server',
			url: [
				'http://localhost:4173/',
				'http://localhost:4173/events',
				'http://localhost:4173/eventbrite-alternative'
			],
			numberOfRuns: 3,
			settings: {
				preset: 'desktop'
			}
		},
		assert: {
			preset: 'lighthouse:recommended',
			assertions: {
				'categories:performance': ['error', { minScore: 0.85 }],
				'categories:accessibility': ['error', { minScore: 0.95 }],
				'categories:seo': ['error', { minScore: 1.0 }],
				'categories:best-practices': ['warn', { minScore: 0.9 }],
				'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
				'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
				interactive: ['error', { maxNumericValue: 3500 }]
			}
		},
		upload: { target: 'temporary-public-storage' }
	}
};
