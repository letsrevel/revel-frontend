import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

export default {
	darkMode: ['class'],
	content: ['./src/**/*.{html,js,svelte,ts}'],
	safelist: ['dark'],
	theme: {
		container: {
			center: true,
			padding: {
				DEFAULT: '1rem', // 16px on mobile
				sm: '1.5rem', // 24px on small screens
				md: '2rem', // 32px on medium screens
				lg: '2rem', // 32px on large screens
				xl: '2rem' // 32px on extra large screens
			},
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			// Nata Sans is the brand font (imported in app.css); preflight picks
			// this up, so it applies app-wide without per-component classes.
			fontFamily: {
				sans: [
					'Nata Sans Variable',
					'ui-sans-serif',
					'system-ui',
					'-apple-system',
					'BlinkMacSystemFont',
					'Segoe UI',
					'sans-serif'
				]
			},
			colors: {
				border: 'hsl(var(--border) / <alpha-value>)',
				input: 'hsl(var(--input) / <alpha-value>)',
				ring: 'hsl(var(--ring) / <alpha-value>)',
				background: 'hsl(var(--background) / <alpha-value>)',
				foreground: 'hsl(var(--foreground) / <alpha-value>)',
				primary: {
					DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
					foreground: 'hsl(var(--primary-foreground) / <alpha-value>)'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
					foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
					foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
					foreground: 'hsl(var(--muted-foreground) / <alpha-value>)'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
					foreground: 'hsl(var(--accent-foreground) / <alpha-value>)'
				},
				// Amber "highlight" pop from the brand palette (badges, callouts).
				highlight: {
					DEFAULT: 'hsl(var(--highlight) / <alpha-value>)',
					foreground: 'hsl(var(--highlight-foreground) / <alpha-value>)'
				},
				// Rebrand additions: success/info complete the semantic set.
				success: {
					DEFAULT: 'hsl(var(--success) / <alpha-value>)',
					foreground: 'hsl(var(--success-foreground) / <alpha-value>)'
				},
				info: {
					DEFAULT: 'hsl(var(--info) / <alpha-value>)',
					foreground: 'hsl(var(--info-foreground) / <alpha-value>)'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
					foreground: 'hsl(var(--popover-foreground) / <alpha-value>)'
				},
				card: {
					DEFAULT: 'hsl(var(--card) / <alpha-value>)',
					foreground: 'hsl(var(--card-foreground) / <alpha-value>)'
				},
				// Poster palette as first-class utilities (bg-poster-amber, ...).
				// Fixed values, identical in dark mode by design (imagery, not surfaces).
				poster: {
					purple: 'hsl(var(--poster-purple) / <alpha-value>)',
					crimson: 'hsl(var(--poster-crimson) / <alpha-value>)',
					'crimson-deep': 'hsl(var(--poster-crimson-deep) / <alpha-value>)',
					lavender: 'hsl(var(--poster-lavender) / <alpha-value>)',
					periwinkle: 'hsl(var(--poster-periwinkle) / <alpha-value>)',
					amber: 'hsl(var(--poster-amber) / <alpha-value>)',
					ink: 'hsl(var(--poster-ink) / <alpha-value>)',
					paper: 'hsl(var(--poster-paper) / <alpha-value>)',
					white: 'hsl(var(--poster-white) / <alpha-value>)'
				}
			},
			// `text-destructive` is destructive-as-TEXT, which owes WCAG 4.5:1 —
			// a different obligation from `bg-destructive`, the FILL, which owes
			// 3:1 and carries --destructive-foreground as its label. In dark mode
			// one value cannot satisfy both (issue #781: the fill measured
			// 3.11:1/2.85:1 when borrowed as text), so the text half reads
			// --destructive-text. Light mode defines the two identically, so this
			// changes nothing there; dark mode gets the AA-safe rose.
			//
			// Overriding `textColor` rather than sweeping ~520 call sites keeps the
			// class name every author already reaches for correct by construction —
			// a new `text-destructive` written tomorrow is safe with no review.
			// Only the textColor scale is remapped: border-/ring-/divide-/fill-
			// destructive still resolve to --destructive via `colors` above.
			// NOTE: this key REPLACES colors.destructive for the textColor scale,
			// so `foreground` must be restated or `text-destructive-foreground`
			// (the fill's label, ~67 call sites) would stop compiling.
			textColor: {
				destructive: {
					DEFAULT: 'hsl(var(--destructive-text) / <alpha-value>)',
					foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			// The landing mocks' float. Both read a CSS variable rather than a
			// literal so the shadow can flip per mode (app.css :root / .dark) —
			// an ink shadow is invisible on the dark aubergine background.
			boxShadow: {
				poster: 'var(--poster-shadow)',
				'poster-lg': 'var(--poster-shadow-lg)'
			}
		}
	},
	plugins: [typography]
} satisfies Config;
