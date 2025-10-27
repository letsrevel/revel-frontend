# PWA Setup Instructions

This document provides instructions for completing the Progressive Web App (PWA) setup for Revel Frontend.

## Current Status

✅ **Completed:**

- PWA manifest.json configured
- Theme color meta tag added
- Viewport fit configured for safe areas
- Mobile-first responsive design
- Touch-friendly interactions
- Loading skeletons for better UX
- Swipe gestures for mobile sheets
- Landscape orientation optimizations

⚠️ **To Complete:**

- Add PWA icons (see below)
- Optional: Add service worker for offline support
- Optional: Add screenshots for app stores

## Required PWA Icons

You need to create the following icon files and place them in the `static/` directory:

### 1. App Icons

- **icon-192.png** (192x192 pixels)
  - Used for Android home screen
  - Should work well as both square and circular (maskable)

- **icon-512.png** (512x512 pixels)
  - Used for splash screens and high-res displays
  - Should work well as both square and circular (maskable)

### Icon Design Guidelines

- Use the Revel logo/brand identity
- Ensure the icon looks good on both light and dark backgrounds
- For maskable icons, keep important content in the "safe zone" (80% of the canvas)
- Background color should match your theme: `#8b5cf6` (purple primary)

### Creating Icons from Your Logo

If you have an SVG or high-res PNG logo:

1. **Using online tools:**
   - [Maskable.app](https://maskable.app/) - Create maskable icons
   - [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator)

2. **Using design tools:**
   - Create a 512x512 canvas
   - Center your logo
   - Ensure 80% safe zone for maskable support
   - Export as PNG

3. **Using ImageMagick (command line):**
   ```bash
   # Resize and add padding for safe zone
   convert logo.png -resize 410x410 -gravity center -extent 512x512 icon-512.png
   convert icon-512.png -resize 192x192 icon-192.png
   ```

### Example Icon Structure

```
static/
├── icon-192.png      ← Create this
├── icon-512.png      ← Create this
├── manifest.json     ✅ Already configured
└── favicon.png       ✅ Already exists
```

## Optional: Screenshots

To make your PWA installable from app stores, add screenshots:

### Mobile Screenshot (required for mobile listing)

- **screenshot-mobile-1.png** (750x1334 or 1080x1920)
- Capture: Events listing page or dashboard
- Show key features in a clean, appealing way

### Desktop Screenshot (required for desktop listing)

- **screenshot-desktop-1.png** (1920x1080 or 1280x800)
- Capture: Events page or dashboard
- Show the desktop layout

## Optional: Service Worker

For offline support and caching, you can add a service worker:

### Using @vite-pwa/sveltekit

```bash
pnpm add -D @vite-pwa/sveltekit
```

Then configure in `svelte.config.js`:

```js
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default {
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			manifest: false, // We already have one
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}']
			}
		})
	]
};
```

### Manual Service Worker (Advanced)

Create `static/service-worker.js`:

```js
const CACHE_NAME = 'revel-v1';
const urlsToCache = ['/', '/events', '/dashboard'];

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)));
});

self.addEventListener('fetch', (event) => {
	event.respondWith(
		caches.match(event.request).then((response) => response || fetch(event.request))
	);
});
```

Register in `src/app.html`:

```html
<script>
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.register('/service-worker.js');
	}
</script>
```

## Testing Your PWA

### Desktop (Chrome/Edge)

1. Open DevTools (F12)
2. Go to Application tab → Manifest
3. Check for errors
4. Click "Add to home screen" to test installation

### Mobile (Android)

1. Visit your app in Chrome
2. Look for "Add to Home Screen" prompt
3. Or use Chrome menu → "Install app"

### Mobile (iOS)

1. Visit your app in Safari
2. Tap Share button
3. Select "Add to Home Screen"
4. Note: iOS has limited PWA support compared to Android

### PWA Testing Tools

- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Built into Chrome DevTools
- [PWABuilder](https://www.pwabuilder.com/) - Test and package your PWA
- [Web.dev](https://web.dev/measure/) - Comprehensive web performance testing

## Deployment Checklist

Before deploying to production:

- [ ] Add icon-192.png and icon-512.png
- [ ] Test manifest.json loads correctly
- [ ] Test "Add to Home Screen" on Android
- [ ] Test "Add to Home Screen" on iOS
- [ ] Run Lighthouse PWA audit (aim for 100% score)
- [ ] Test offline functionality (if using service worker)
- [ ] Verify theme color appears in browser UI

## Resources

- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [web.dev: PWA Checklist](https://web.dev/pwa-checklist/)
- [Maskable Icons](https://web.dev/maskable-icon/)
- [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator)
