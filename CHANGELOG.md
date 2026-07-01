# Changelog

All notable changes to the Revel Frontend are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.64.0] - 2026-07-01

### Added
- **Brand identity evaluation (demo/staging only)**: a new opt-in brand switcher, visible on the demo/staging environment and in local development, lets testers preview four candidate 2026 rebrands against the current **Legacy** look — **Gradient** (full-page purple→crimson wash), **Midnight** (near-black with neon accents), **Crimson** (hot, crimson-led), and **Mono** (stark black & white) — each with full light and dark modes. The default stays Legacy, so normal visitors see no change. Foundation only: the new palette (Hearty Purple / Light Crimson / Amber highlight, purple→crimson gradient) and the Nata Sans typeface are wired through the existing design tokens, with the final visual design to follow.

## [1.63.0] - 2026-06-29

### Changed
- **Localized dates**: every human-facing date now follows your chosen UI language with textual months everywhere — no more browser-locale numeric dates (`6/7/2026`) or mismatched month names. Native `datetime-local` inputs across admin flows (event/poll duplication, generate-now, record-payment, waitlist cutoff, org-token expiry, recurrence end, schedule editor, admission deadline, and more) now share the `DateTimePicker` with an unambiguous textual readback line.
- Dashboard **Upcoming RSVPs** list filter is now URL-driven multi-select (`?status=yes,maybe`) with accessible toggle chips (All / Going / Maybe / Not going); the dashboard card links straight to the matching Going + Maybe view, so the count and the list agree.

### Fixed
- The dashboard **Upcoming RSVPs** count now includes both **Going** and **Maybe** responses (was Going only), so a tentative RSVP you're most likely to forget is no longer hidden.
- Dates no longer ignore the app language — switching the UI language now updates them (e.g. an app set to English or Italian on a French browser no longer shows `Week of 1 Juin – 7 Juin 2026`). French dates also no longer silently fall back to US English formatting.

## [1.62.1] - 2026-06-28

### Fixed
- First-time visitors whose browser language is not English no longer see the landing page briefly render in that language and then flip to English; the page now stays in the detected language consistently.
- The "Welcome to Revel" heading no longer stays stuck in the browser's language while the rest of the page is shown in another language.

## [1.62.0] - 2026-06-22

### Added
- **Organization financials**: new owner-only Financials page (`/org/{slug}/admin/financials`) showing revenue, refunds, net income, and per-VAT-rate breakdowns by currency and event, with year/quarter/month period filtering, sorting, and a multi-currency switcher.
  - On-demand revenue & VAT report download (`RevenueReportButton`) scoped to the selected period.
  - Scheduled report delivery via a `revenue_report_cadence` setting (none/monthly/quarterly) in org settings, requiring a billing email.
  - Per-event revenue card now shows the same VAT/net-taxable/rate-bucket breakdown.
- **Event schedule / timeline**: events can display a session timeline (start/end times in the event's timezone, location, description, and a Required badge) on the public page, with an inline editor for organizers to add repeatable sessions.
- **WYSIWYG description editor**: the raw-markdown editor across all description fields (events, orgs, tiers, questionnaires, polls, resources, venues, profiles, announcements) is now a rich-text editor with a formatting toolbar (bold, italic, strikethrough, headings, lists, blockquote, code), a link-insertion dialog, and a visual/source toggle.
- **Image cropping for all uploads**: event, organization, and event-series logos and cover/banner images now open a crop-and-reposition modal before upload (previously only profile pictures), so you control the framing instead of the server auto-cropping. Cropped logos preserve PNG transparency.
- **French (`fr`) language support**: full French translation catalog, language switcher option, and French SEO landing pages.
- **Top-level org-admin Tickets tab**: ticket management is reachable without drilling into a specific event, via a picker of ticketed events (auto-redirects when there is a single active ticketed event).
- **Open-ended events**: an explicit "Open-ended event" checkbox replaces the misleading "leave blank" copy; when off, an end time is required. Open-ended events show the start plus an "Open-ended" hint everywhere (detail, header, calendar, admin list, RSVP card, recurring-series templates).
- **Announcement scheduling**: send-now or scheduled delivery (absolute date/time, or relative to event start/end), a Scheduled admin tab with badges, and an unschedule action.
- "Also email people who join later" option for event announcements (delta-send to new sign-ups).
- Guest sign-in prompt (`EventGuestSignInPrompt`) for logged-out event visitors, listing what they unlock (potluck, announcements, who's coming, dietary preferences) instead of showing silent empty states.
- Manual ticket-code entry fallback in the QR check-in scanner for when the camera fails, plus specific per-error messages and an HTTPS guard.
- Next/Previous navigation (with "n of m" position) when reviewing questionnaire submissions, respecting the list's current filter/sort.
- "Total earned" revenue box on the event ticket-admin page, showing gross with a net/refunded sub-line per currency.
- Sortable ticket list (by tier, price, status, payment method, purchase date) with sort persisted in the URL; mobile sort selector.
- Per-ticket discount badge in the ticket-admin list showing the applied discount code and amount off.
- Immediate "you're all set — buy your ticket / RSVP now" confirmation when a questionnaire submission is auto-accepted (no evaluation required), with an "Auto-accepted" status badge for submissions that grant access without review.
- Audience descriptor on announcement cards (who can see it).
- "What does membership grant?" collapsible disclosure explaining concrete membership benefits on org member pages and the public request-membership prompt.
- Attendee-list visibility control surfaced next to the profile photo uploader (auto-saving).

### Changed
- **Event times now render in the event's timezone** (with the timezone abbreviation and a disclaimer) across event cards, headers, details, eligibility deadlines, and ticket tiers, instead of the viewer's local zone.
- Feature-flag-gated UI is now hidden when the backend capability is disabled: "Create organization" CTAs/route and Telegram connect cards/fields disappear (with a note) when off.
- Invite-link expiration now uses a date/time picker (matching the edit form) and prefills from the event start date; coupon validity prefills from a single scoped event. Empty means never expires.
- Pressing Enter in date/time pickers now commits the value and closes the popup instead of submitting the form.
- Event announcements moved up directly under Event Details (with a tinted card) for discoverability.
- Past, closed, and cancelled events can now be edited from the org-admin events list.
- Notification dropdown: removed the redundant type chip and relaxed the body clamp from 2 to 4 lines.
- Discount-code admin page fully localized; clearer past-visibility announcement copy distinguishing in-page visibility from emailing.
- Authenticated landing page now leads with a Dashboard CTA; "Browse Events" is secondary.
- Discount-code delete now distinguishes hard-deleting unused codes from deactivating used ones, with matching icons, confirm copy, and toasts.
- Roughly 1,265 previously-hardcoded user-facing strings across the app are now translated (en/de/it/fr).
- The image cropper now has a draggable zoom slider in place of the +/− zoom buttons, and its rotate controls were removed.
- The home page's multi-language highlight now lists French alongside English, German, and Italian.

### Fixed
- The navbar now reflects login immediately after signing in (including 2FA), without needing a manual page refresh.
- Eliminated the light-mode flash (FOUC) that dark-mode users saw on initial load and navigation in production.
- Single-ticket checkout no longer fails when the buyer's display name is empty (falls back to a localized "Guest" placeholder).
- Ticket expiration countdown is now announced to screen-reader and keyboard users (was hover-only).
- The language picker now closes when you click elsewhere on the page or press Escape, not only via its toggle or selecting a language.

## [1.61.1] - 2026-06-14

### Fixed
- Restored API calls and backend-served images on deployments pointed at a non-default backend, whose origin was previously blocked by the Content Security Policy.

## [1.61.0] - 2026-06-14

### Changed
- The API endpoint is now resolved at runtime, so a single build can target any backend (self-hosting); deployments must set `PUBLIC_API_URL` at runtime or the app falls back to `http://localhost:8000`.

### Fixed
- Cancel-ticket dialog no longer shows contradictory payment notes when the refund is €0, and explains a €0 quote by surfacing the most recent expired refund window.
- Language switcher now shows ISO codes (`en`/`de`/`it`) instead of country flags.

## [1.60.0] - 2026-06-13

_Maintenance release — internal, tooling, or dependency changes only._

## [1.59.3] - 2026-06-12

### Fixed
- Restored login and registration in production, which were failing with a "Field required" error because server-rendered POST request bodies arrived empty at the backend.

## [1.59.2] - 2026-06-10

### Fixed
- Restored all server-rendered pages, which had stopped loading due to a redirect loop on internal API calls.

## [1.59.1] - 2026-06-10

### Changed
- Location-based "nearest first" ordering on server-rendered pages now uses the real visitor's IP rather than the server's, improving distance-sorted results, geolocation, and rate-limiting accuracy.

## [1.59.0] - 2026-06-02

### Added
- **Event cancellation reason**: organizers can attach an optional message when cancelling an event; it's shown to all participants on the public event page and included in the cancellation notification. The cancel flow now uses a proper dialog (replacing the old browser confirm prompt) and is reachable from both the admin events list and the event edit page.

### Fixed
- Sitemap pages no longer return errors to crawlers (request page size now respects the backend limit).

## [1.58.0] - 2026-05-28

### Added
- Duplicate a questionnaire or poll from its card or detail header, opening a pre-filled create form.

## [1.57.0] - 2026-05-26

### Added
- **Bookmark events**: signed-in users can bookmark events from event cards and the event detail page, with a "Bookmarked" filter on the dashboard. The card indicator appears only on already-bookmarked events (top-left, clear of status chips), and bookmarks sync across all views.

## [1.56.0] - 2026-05-25

### Added
- **Polls**: full admin experience (create/edit with audience, anonymity, and scheduling controls, plus lifecycle actions and a copyable voter link) alongside a public voter page; polls get their own navigation item and dashboard tile.

## [1.55.0] - 2026-05-21

### Added
- **Advanced waitlist offers**: admins can configure waitlist behavior and issue, revoke, or reactivate offers; the public event page surfaces waitlist position, reserved spots, and an active-offer banner with a live countdown, plus a matching notification.
- "Calendar" shortcut on the public organization page, linking to that org's events pre-filtered in calendar view.

### Fixed
- "Confirm Payment" no longer appears on cancelled tickets in the organizer's ticket list.
- Waitlist offer claim button now disappears once the offer expires.

## [1.54.0] - 2026-05-18

### Added
- **Self-served email change**: users can change their account email from the security card, with a public confirmation page that supports confirming on a different device.

## [1.53.0] - 2026-05-18

### Changed
- Series picker and admin series cards now distinguish grouping vs. recurring series with dedicated icons and a corner type badge; the recurring label reads "Automatic".

### Fixed
- Editing an existing event no longer fails validation when its start time is in the past (organizers can update details after an event has begun).

## [1.52.0] - 2026-05-16

### Added
- Composite duration picker (number + unit) across four admin forms.

### Changed
- Subscriptions admin table shows the membership type/tier, and the create-subscription dropdown groups plans by tier.

### Fixed
- Page tabs no longer became unclickable after creating a subscription.

## [1.51.0] - 2026-05-15

### Added
- **Staff-managed membership subscriptions (offline)**: admin surfaces to create and manage subscriptions, plus a read-only `/account/memberships` page and a membership card on the public organization page.

### Changed
- Event series list now leads with a "New recurring series" call to action; the legacy empty-series form moves to a secondary link.
- Renamed "Private" to "Invitation only" across the event UI (visibility, event type, address visibility, badges, filters); event invitation-message field gains explanatory helper text.
- Profile first, last, and preferred name are now optional.

### Fixed
- "Edit template" on the recurring-series dashboard no longer 404s.

## [1.50.2] - 2026-05-11

### Fixed
- Currency selector in tier and discount-code forms now offers the full set of 30 supported currencies (and drops the unsupported BGN).

## [1.50.1] - 2026-05-09

### Changed
- Public questionnaire submission redirects back to the event immediately (no artificial delay), keeping the spinner visible until navigation.
- Event editor: enabling "Allow guest attendance" now warns about incompatible settings, the waitlist toggle gains a "How does the waitlist work?" explainer, and the recurring-event wizard explains what a template event is.

### Fixed
- On validation failure the event editor scrolls to the first invalid field and shows a toast, instead of leaving the error off-screen.
- Blacklist and invitation dialogs keep their submit button reachable on small/mobile viewports.
- Conditional questionnaire sub-questions no longer lose their dependency link when edited.

## [1.50.0] - 2026-05-08

### Added
- **Organization contact method**: orgs can choose None, an email link, or an in-app contact form (email/form options gated on a verified contact email); a contact button appears on the public org page and the event-detail org card.
- Technical SEO foundation: structured data (Event, Organization, Series, FAQ, HowTo, etc.) and hreflang across public pages.

## [1.49.0] - 2026-04-25

### Added
- **User-initiated ticket cancellation & refunds**: buyers see a cancellation preview (refund amount, fees, deadline, remaining windows) and can cancel eligible tickets; the refund policy is shown before payment. Admins get a per-tier refund-policy editor (bracketed refund percentages, flat fee, cancellation toggle and deadline), and ticket tables show refund-status pills.
- **Recurring events**: a create-recurring-series wizard with an accessible recurrence-rule editor (frequency, weekly/monthly modes, end boundaries) and a live human-readable summary.

## [1.48.1] - 2026-04-17

### Fixed
- The "Feedback" questionnaire type can now be selected when editing a questionnaire (previously only on creation).
- Long invitation dialogs (create/edit/bulk) keep header, footer, and submit button reachable on small viewports.

## [1.48.0] - 2026-03-31

### Added
- **Attendee billing & invoicing**: a reusable billing-profile form in account settings, an `/account/invoices` page (buyer invoice list + PDF download), and a VAT preview during ticket checkout for both authenticated and guest flows. Org admins get an invoicing-mode toggle (none/hybrid/auto) and attendee invoice and credit-note management pages.

### Fixed
- Pricing card and fee calculator now note that platform fees exclude VAT where applicable.

## [1.47.1] - 2026-03-28

### Fixed
- PDF ticket downloads and referral payout statement downloads now resolve against the backend origin instead of the frontend, so the files download correctly.

## [1.47.0] - 2026-03-26

### Changed
- **Refreshed landing hero**: warmer gradient tagline ("Free. Open. Safe."), a subtle radial glow, and an animated shine effect on the "Revel" wordmark (with reduced-motion and unsupported-browser fallbacks); the navbar logo now always links to the home page.

## [1.46.0] - 2026-03-25

### Added
- **Unlisted events**: a new visibility option for events that are reachable only via direct link and hidden from browse/search; staff and owners still see them in admin views with an "Unlisted" badge.

## [1.45.0] - 2026-03-24

### Added
- **Tier-linked invitations**: invitations and invitation links can now grant access to specific ticket tiers via multi-select, with tier restrictions for visibility and purchasing; non-purchasable tiers are greyed out on the public event page.
- Event admins can toggle `public_pronoun_distribution` to choose whether pronoun statistics are visible to all attendees or only to org staff and owners.

### Fixed
- Reordering questions in the questionnaire editor now persists, and reordering uses arrow buttons instead of drag-and-drop.

## [1.44.0] - 2026-03-23

### Added
- **Referral program**: referral code entry on registration (auto-filled from `?ref=`), an account referral settings page (Stripe Connect, billing, self-billing), a payouts history page with statement downloads, and referral links in the user menu for referrers.
- "Show already accepted" toggle on the dashboard invitations page (accepted invitations are hidden by default).
- Copy-to-clipboard button for each discount code in the admin discount-codes list.
- `.m4a` audio uploads are now accepted.

### Changed
- Discount code inputs (purchase and admin creation) now enforce alphanumeric-only characters, including Unicode letters.

### Fixed
- The event share button now shows a success/error toast when copying the link.

## [1.43.0] - 2026-03-20

### Changed
- Questionnaire editing: multiple options can be marked correct even when multiple answers are disabled; LLM evaluation guidelines are hidden when evaluation mode is manual.
- Questionnaire create/edit now defaults to Manual evaluation, with Hybrid and Automatic marked "Coming soon"; save failures surface the backend error detail. Retake-cooldown hints and countdowns were corrected (0 means immediate retake; fixed an erroneous "Available tomorrow").

### Fixed
- Ticket and tier prices no longer get corrupted on save under non-English browser locales (e.g. `33.33` becoming `33.31`); currency/decimal fields now accept locale-aware input and display.
- Expired or fully-used invitation links now show a clear "Link No Longer Valid" page instead of a confusing 404.
- Translated remaining hardcoded English pricing strings on the landing page.

## [1.42.0] - 2026-03-19

### Added
- Billing name field on the organization billing info form.

### Changed
- The billing nav badge now blinks only when Stripe is connected, platform fees apply, and billing info is incomplete, and updates immediately after saving.

## [1.41.1] - 2026-03-17

_Maintenance release — internal, tooling, or dependency changes only._

## [1.41.0] - 2026-03-17

### Fixed
- Questionnaire max-attempts value now loads correctly when editing (previously reset to 0), and the field was added to the create form.

## [1.40.1] - 2026-03-11

_Maintenance release — internal, tooling, or dependency changes only._

## [1.40.0] - 2026-03-11

### Added
- **VAT billing**: organization billing settings (country, VAT rate, address, email), plus invoices and credit notes pages.
- `requires_evaluation` toggle on questionnaires: when evaluation is off, evaluation mode, min score, LLM guidelines, and related submission UI are hidden.

### Changed
- Free-text questionnaire answers now allow up to 1000 characters (was 500).

### Fixed
- The navbar now reflects profile and picture changes immediately without a page refresh.
- Long custom invitation messages are truncated with a "Show more" toggle.

### Removed
- Ticket tier selection from invitation create/edit/bulk-edit dialogs and invitation links (tier linking no longer enforced on invitations at this point).

## [1.39.2] - 2026-03-09

### Fixed
- Claiming an invitation that has an attached questionnaire no longer triggers an infinite loop.

## [1.39.1] - 2026-03-08

### Fixed
- Audio and video attachments from the API now play correctly (added the missing `media-src` content-security-policy directive).

## [1.39.0] - 2026-03-08

### Changed
- **Single-page event editor** replaces the multi-step event wizard: essentials first then details on creation, all fields on one page (with tabs for ticketed events) on edit, plus sticky save bars; "Edit Event" and "Ticketing" CTAs added to the tickets and attendees pages.

### Fixed
- Audio recorded via the browser (WebM) now plays back correctly.

## [1.38.0] - 2026-03-08

### Added
- Pronoun distribution in the questionnaire summary, and CSV/export buttons (with auto-download) on the questionnaire summary, attendees, and tickets admin pages.

## [1.37.0] - 2026-03-05

### Added
- **Discount codes**: full admin CRUD under org admin — list page with search, status/type filters, pagination, and inline enable/disable and delete; create and edit pages with code, type, value, currency, validity dates, and usage limits; scope assignment across series, events, and tiers; and per-code usage statistics.
- Discount-code redemption at checkout: a collapsible "Have a discount code?" field in the ticket confirmation dialog that validates the code and shows the original price struck through alongside the discounted price; a `?discount=CODE` link pre-fills and opens it automatically.
- Ticket-type filter (Ticketed / Free RSVP) on the events listing sidebar, mobile filter sheet, organization profile, and dashboard.

### Changed
- Currency selectors are now restricted to EUR, USD, GBP, CHF, and EU member-state currencies.

### Fixed
- Event info now shows the event type instead of the event's visibility setting.

## [1.36.11] - 2026-03-03

### Fixed
- Management of tokens that grant staff access is now restricted to organization owners.

## [1.36.10] - 2026-02-27

### Changed
- The ticket purchase flow now always shows a guest-name field (pre-filled with your display name) to avoid checkout validation errors, and tier buttons use clearer labels (Buy Ticket, Claim Free Ticket, Reserve Ticket, Get Ticket).

### Fixed
- The navigation bar now clears immediately on logout, and the homepage call-to-action buttons adapt to signed-in versus signed-out state.

## [1.36.9] - 2026-02-25

### Fixed
- Pay-what-you-can tiers now route to the correct checkout endpoint.

## [1.36.8] - 2026-02-24

### Security
- Added DOMPurify sanitization and HTML escaping for user-supplied content rendered as HTML (markdown bodies, invitation/whitelist requests, org join page, SEO metadata).

## [1.36.7] - 2026-02-23

_Maintenance release — internal, tooling, or dependency changes only._

## [1.36.6] - 2026-02-23

_Maintenance release — internal, tooling, or dependency changes only._

## [1.36.5] - 2026-02-23

### Fixed
- Restored the production deploy by correcting Content-Security-Policy directives.

## [1.36.4] - 2026-02-23

### Security
- Hardened the map-embed against XSS and updated dependencies.

## [1.36.3] - 2026-02-17

### Fixed
- Ticket price display now prioritizes the actual payment amount.

## [1.36.2] - 2026-02-17

### Fixed
- Guest checkout dialogs now properly surface errors and eligibility states.

## [1.36.1] - 2026-02-17

### Fixed
- The ticket purchase button no longer stays stuck in a processing state after a non-online pay-what-you-can checkout.
- Flattened heading sizes in notification bodies for consistent display.

## [1.36.0] - 2026-02-16

### Changed
- The ticket preview now offers a PDF download instead of a QR-code image download.

## [1.35.3] - 2026-02-16

### Fixed
- Resolved 401 errors on cold start by moving token refresh into server hooks.

## [1.35.2] - 2026-02-15

### Fixed
- Ticket tiers now preserve the backend ordering instead of being re-sorted by price.

## [1.35.1] - 2026-02-14

### Fixed
- Tags now appear on the organization detail page, matching event and series pages.

## [1.35.0] - 2026-02-14

### Added
- **Pay-what-you-can check-in**: capture `price_paid` for offline / at-the-door PWYC tickets during check-in, with the tier's PWYC range shown and the field pre-filled.

### Changed
- Event, organization, and series cards now use the high-resolution social preview image for cover art instead of the low-res, blurry thumbnail.

### Fixed
- Ticket checkout now keeps the confirmation dialog open with a loading spinner until the server responds, instead of closing immediately and leaving no feedback.
- Questionnaire edit checkboxes no longer revert to stale values after saving.

## [1.34.0] - 2026-02-13

### Added
- **Questionnaire summary page**: a new admin view with submission/approval stats, status breakdown, score statistics, and multiple-choice answer distributions, with event/series filtering.
- Per-event toggle on questionnaire create and edit forms (for admission questionnaires).
- Up/down buttons to reorder ticket tiers, with optimistic updates.

### Fixed
- Submission stats now use server-side totals instead of only counting the current page of 20 results.
- Resolved an infinite loop in the questionnaire assignment modal.

## [1.33.0] - 2026-02-10

### Added
- **Maintenance banner**: a global, severity-styled banner driven by the `/api/version` endpoint, with client-side expiry, per-session dismissal, dark mode, and i18n (en/de/it).

## [1.32.4] - 2026-02-10

### Added
- "Include past events" checkbox in the questionnaire assignment modal, enabling post-event feedback questionnaires.

## [1.32.3] - 2026-02-08

### Fixed
- Admin attendees and tickets pages now show RSVPs and tickets for past events instead of empty lists.

## [1.32.2] - 2026-02-08

### Fixed
- Announcement event picker now shows a "No events available" message instead of an endless spinner when there are no events, and adds an "include past events" option for targeting past events.

## [1.32.1] - 2026-02-05

### Fixed
- Editing an announcement now loads its full content; previously the body was empty and saving failed with a validation error.

## [1.32.0] - 2026-02-04

### Added
- Invitation tokens are now auto-claimed on login (not just after signup), with toast notifications naming the organization or event.

### Changed
- Questionnaire editing workflow improvements: open creation in a new tab, redirect to the edit page after creating, allow editing any questionnaire (not just drafts), explicit Edit/Cancel buttons, stay on the edit page after saving, and a "New Resource" button plus focus-based auto-refresh in resource assignment modals.
- Footer redesigned into a symmetrical layout with separate frontend/backend version labels; "Send Feedback" moved to the Resources column.

### Fixed
- Resource descriptions now render markdown (bold, italic, links) instead of raw syntax.

## [1.31.0] - 2026-02-03

### Added
- **Venue info modal**: a "More info about the venue" link surfaces detailed venue information (address, capacity, Google Maps link, embedded map, markdown description); venue descriptions now support markdown.
- Info icon next to footer version numbers to signal that hovering reveals release notes.

## [1.30.7] - 2026-02-03

### Added
- "Waives apply deadline" option in the event invitation modal.

### Fixed
- Event details (address, map URL, embedded map) now refresh immediately after RSVP so attendee-only fields appear without a manual reload.

## [1.30.6] - 2026-02-03

### Changed
- Footer polish: Solutions section split into two columns to reduce height, with hover tooltips on version links showing GitHub release notes (fetched lazily and cached).

## [1.30.5] - 2026-02-03

### Changed
- Creating and claiming a potluck item is now a single atomic action, reducing duplicate notifications.

## [1.30.4] - 2026-02-02

### Fixed
- Changing the interface language no longer occasionally reverts to the previous language due to a race condition.

## [1.30.3] - 2026-02-01

### Fixed
- Fixed a 404 from the dietary-preferences link on the profile page.
- Event creation wizard now scrolls back to the top when changing steps.

## [1.30.2] - 2026-01-30

### Fixed
- Fixed a crash on step 2 of the event wizard where tooltips on the questionnaires section triggered a missing-context error, leaving UI elements unresponsive.

## [1.30.1] - 2026-01-29

### Fixed
- The event wizard now validates step 2 before letting you advance to the ticketing step.

## [1.30.0] - 2026-01-27

### Added
- **Audio recording for questionnaires**: record audio answers directly in the browser for file-upload questions, with an inline player offering 1x/1.5x/2x playback speed (remembered between sessions) in submission review and on your privacy page; supports Chrome, Firefox, and Safari.

### Changed
- Clearer password strength feedback: unmet requirements now show in red, the label reads "Almost there" until all requirements are met, and the strength label is color-coded to the progress bar.

## [1.29.1] - 2026-01-27

### Fixed
- Fixed the registration button being stuck disabled on Brave for mobile.

## [1.29.0] - 2026-01-25

### Added
- **Organization announcements**: organizers can create, edit, save as draft, and send announcements with audience targeting from a new announcements admin page (`/org/[slug]/admin/announcements`), with draft/sent tabs and search; quick "New Announcement" actions are available from the dashboard and pre-filled from an event's sidebar. A `send_announcements` permission gates access.
- Published announcements appear in a collapsible section on event detail pages and on organization public pages, rendered as markdown.

## [1.28.2] - 2026-01-23

### Changed
- Minor styling adjustment to the attendee list.

## [1.28.1] - 2026-01-23

### Changed
- German translations now use the informal "you" (du) throughout instead of the formal form.

## [1.28.0] - 2026-01-21

### Added
- Admin tickets page can now mark a payment as unconfirmed (reversing a confirmation), with added translations.

## [1.27.0] - 2026-01-21

### Added
- Event detail sidebar shows effective capacity and warns when a sector's hard limit is exceeded.

### Changed
- Restructured the location fields in the event creation wizard.
- The attendee count now shows in the event sidebar even when no capacity limit is set.

### Fixed
- Per-tier remaining-ticket counts now display correctly.
- Pay-what-you-can ticket amounts are now validated against the allowed range in real time.

## [1.26.0] - 2026-01-20

### Added
- Pronoun distribution breakdown on event detail pages, showing a bar chart of attendee pronouns (with counts, percentages, and a "Not specified" category) below the attendee list on mobile and desktop.

## [1.25.4] - 2026-01-19

_Maintenance release — internal, tooling, or dependency changes only._

## [1.25.3] - 2026-01-19

### Added
- Image cropper modal when uploading a profile picture, letting you crop before saving.

## [1.25.2] - 2026-01-19

### Fixed
- After completing your profile, you're now redirected back to the event you came from instead of being left on the profile page.

## [1.25.1] - 2026-01-18

### Changed
- Profile pictures and organization logos now use optimized thumbnails for faster loading.

## [1.25.0] - 2026-01-18

### Added
- **Profile picture uploader**, plus a "complete profile required" eligibility gate for events that need a full profile.
- **File upload questions** in questionnaires, with a new files-management section on your privacy page.
- **Follow organizations and event series** with customizable notification preferences.

## [1.23.0] - 2026-01-15

### Added
- **Feedback questionnaires**: post-event surveys can now be created (the "Feedback" questionnaire type is no longer "Coming soon"), and attendees see a feedback call-to-action in the event sidebar after an event they attended has ended.
- **Admin impersonation**: admins can impersonate another user, with a persistent banner indicating the active impersonation session.

## [1.22.0] - 2026-01-15

### Added
- Editing UI for draft questionnaires, allowing admins to modify questions on existing questionnaires.
- Additional quick-action cards (Questionnaires, Resources, Blacklist, Venues) on the organization admin dashboard, improving navigation on mobile where tabs collapse.

## [1.21.1] - 2026-01-14

### Fixed
- Returning users with "Remember Me" enabled are no longer shown as logged out after their access token expires; the session is now restored automatically from the refresh token.

## [1.21.0] - 2026-01-14

### Changed
- Pending ticket experience refined: payment instructions now appear only after a ticket is reserved (removed from tier selection and confirmation dialogs), and the pending-ticket status badge shows orange instead of green to match the pending-payment banner.

## [1.20.2] - 2026-01-14

### Fixed
- Notification items in the dropdown now navigate correctly when clicked, including notifications whose target is an absolute URL.

## [1.20.1] - 2026-01-13

### Added
- **Blacklist & whitelist management**: organization admins get a dedicated blacklist admin page, plus blacklist entry and whitelist request management, and a "Request whitelist" flow for users.

## [1.19.0] - 2026-01-12

### Added
- **Maps integration for events**: event addresses become clickable map links, an embedded map can be shown in the event sidebar, and admins can configure a maps link and embed code (with live preview) in the event wizard.
- "Make Member" action on event admin attendees and ticket-holder pages, letting admins add attendees as organization members directly.

## [1.18.2] - 2026-01-11

_Maintenance release — internal, tooling, or dependency changes only._

## [1.18.1] - 2026-01-10

### Fixed
- At check-in, the "Confirm Payment & Check In" button is now enabled for pending tickets that require offline payment confirmation.

## [1.18.0] - 2026-01-10

### Added
- Support for an `apply_before` deadline that controls until when users can submit questionnaires or invitation requests for an event, surfaced in eligibility messaging and configurable in the event wizard.

### Fixed
- Language switching on SEO landing pages now navigates to the correct language-prefixed URL and persists the choice; added missing German and Italian translations across event page components.

## [1.17.1] - 2026-01-10

### Changed
- All notifications are now clickable (falling back to the notifications page when no specific link exists), and a "Mark all as read" button was added to the notification dropdown.

## [1.17.0] - 2026-01-09

### Added
- **Conditional questions**: questionnaires can now show additional questions or sections based on a selected multiple-choice option.
- Eligibility now shows a "waiting for invitation approval" state when a user has requested an invitation to a private event.

## [1.16.9] - 2026-01-08

### Fixed
- `max_tickets_per_user` is now included in event update requests, so the per-user ticket limit saves correctly when editing an event.

## [1.16.8] - 2026-01-07

### Fixed
- Ticket purchasing now falls back to the event-level per-user ticket limit when a tier's own limit is unset.

## [1.16.7] - 2026-01-07

_Maintenance release — internal, tooling, or dependency changes only._

## [1.16.6] - 2026-01-07

### Fixed
- Respect the event-level maximum tickets per user during checkout, instead of falling back to the (much larger) tier quantity.
- Pay-what-you-can tiers now route to the correct checkout endpoint, including offline PWYC tiers that previously hit the regular checkout.
- Surface the manual payment instructions field in the ticket tier form when the payment method is offline or at-the-door.
- Fix a double-toggle bug where clicking a checkbox directly in the questionnaire assignment modals failed to select the item.
- Make draft questionnaire status more prominent with amber styling on the status card, badge, and list view.

## [1.16.5] - 2026-01-06

### Added
- **Remember me**: the login checkbox now works — unchecked keeps you signed in only for the browser session, checked persists your login for 30 days.
- "Already have an account? Log in" link on the homepage, making login reachable on mobile without the burger menu.

### Fixed
- Make the invitations page tabs wrap and use short labels (Requests, Invitations, Links) so they fit on small screens, with German and Italian translations.

## [1.16.4] - 2026-01-06

### Fixed
- Resolve an "endless loading" hang on event pages with many potluck items, caused by excessive debug logging during hydration.
- Prevent browsers (Chromium, Safari) from hanging on the event page by limiting module preload hints.

## [1.16.3] - 2026-01-06

### Fixed
- Markdown content (headers, lists, spacing, indentation) now renders with correct typographic styling.
- Past events admin page: fix broken View, Attendees, and Invitations links, and correct cover image display.

## [1.16.2] - 2026-01-06

_Maintenance release — internal, tooling, or dependency changes only._

## [1.16.1] - 2026-01-06

### Fixed
- Make links inside markdown content visible and clearly interactive (primary color, underline, hover effect).

## [1.16.0] - 2026-01-06

### Changed
- Restrict the questionnaire type selector to the "Admission" type, with "Coming soon" badges on membership, feedback, and generic types; new questionnaires now default to Admission.

## [1.15.0] - 2026-01-05

### Changed
- **Questionnaire builder overhaul**: sections with drag-and-drop reordering, drag-and-drop questions within and between sections, and markdown support across questionnaire description, section description, question text, hints, and reviewer notes.
- Submission and evaluation pages render markdown, and submission detail shows full user info (pronouns, full name, preferred name).
- New questionnaires now default to manual evaluation.

### Fixed
- Remove an incorrect rule requiring at least two options for multiple-choice questions.

## [1.14.0] - 2025-12-28

### Added
- Questionnaire setting to exempt organization members, letting them automatically bypass and pass the questionnaire.

### Changed
- Render event, organization, potluck, notification, and legal-page text as markdown (matching the backend's switch to sanitized markdown), with previews and SEO meta text derived from the markdown.

### Fixed
- Potluck item notes now populate correctly when editing an item.

## [1.13.8] - 2025-12-23

### Fixed
- Clicking "Change RSVP" now actually shows the RSVP buttons instead of only toggling the label.

## [1.13.7] - 2025-12-19

### Added
- Show your current attendee-list visibility setting in the "Who's Coming" section, with a quick link to manage it in account settings.

### Fixed
- Allow users holding an active ticket to claim potluck items (previously only legacy RSVP/ticket formats were recognized).

## [1.13.5] - 2025-12-16

### Fixed
- Add defensive handling for events with missing dates so the event page no longer hangs during server-side rendering.

## [1.13.4] - 2025-12-12

### Added
- New "Community-First Event Platform" landing page (English, German, Italian) highlighting organizations, membership tiers, member-only events, and potluck coordination.

## [1.13.3] - 2025-12-12

### Added
- **Guest multi-ticket checkout**: buy multiple tickets in one flow with per-ticket guest names, seat selection (choose-your-seat, random, or none), quantity controls, and total price calculation.

## [1.13.2] - 2025-12-12

### Fixed
- Replace silent failures and "[object Object]" messages with user-friendly error toasts across all API calls, including network/offline and timeout errors.

## [1.13.1] - 2025-12-12

### Added
- **SEO landing pages**: 15 audience-targeted landing pages in English, German, and Italian (`/eventbrite-alternative`, `/queer-event-management`, `/kink-event-ticketing`, `/self-hosted-event-platform`, `/privacy-focused-events`), each with FAQ accordions and calls to action, linked from a new footer "Solutions" section and a homepage "Use Cases" section.
- Social media links (Instagram, Facebook, Bluesky, Telegram) on organization profiles, with matching fields in organization settings.
- RSS event feed at `/feed.xml` and an OpenSearch browser-integration description at `/opensearch.xml`.

### Changed
- Richer search-engine and social previews across public pages via JSON-LD structured data (breadcrumbs, event/organization listings, venue/place info), an expanded sitemap, and refined robots rules.

## [1.13.0] - 2025-12-12

### Added
- **Multi-ticket purchase**: buy several tickets in a single checkout, with a quantity selector and a guest-name field per ticket holder; tickets now display the guest name and seat (venue, sector, seat) details.
- "Buy More Tickets" and "View All Tickets" actions, plus the ability to cancel a pending ticket reservation.
- **Venue & seating management**: create, edit, and delete venues and their sectors under a new Venues admin section, with an interactive seat-grid editor supporting drag-to-select, configurable grid size, letter/number row labels, invertible row order, and aisle insertion.
- Seat-assignment configuration on ticket tiers (none, random, or user-selected) with a venue/sector selector.

## [1.12.1] - 2025-12-02

### Added
- Spam-folder warnings across email confirmation flows (registration check-email, password reset, and profile email verification) so users know where to look for the message.

### Fixed
- Hardcoded English strings on the password-reset page now translate properly.

## [1.12.0] - 2025-12-01

### Fixed
- Logged-in users now see restricted content (private events/organizations and attendees-only resources) on public pages that previously omitted authentication.
- Changing the interface language as a logged-in user now sticks instead of reverting to the previously saved preference.

## [1.11.0] - 2025-12-01

### Added
- **Address visibility control** in the event wizard: organizers can restrict who sees an event's address (Public, Members Only, Attendees Only, or Private).
- Attendees-only visibility option for resources, restricting content to RSVP-yes attendees and ticket holders, with a matching badge and admin filter.

## [1.10.0] - 2025-11-30

### Added
- **Apple Wallet passes**: download event tickets as `.pkpass` files to Apple Wallet from the event detail page, the dashboard tickets list, and the ticket modal.

### Changed
- Dashboard ticket cards now wrap long event names instead of truncating and show locale-aware purchase dates.

## [1.9.0] - 2025-11-29

### Added
- **Event duplication**: duplicate any event from its action menu, pre-filled with "Copy of {name}", landing on the new event's edit page.
- Inline event slug editing in the wizard with a live URL preview and collision handling.

### Changed
- Event card actions consolidated into a three-dot menu, keeping primary actions (view, tickets, invitations) visible while grouping cancel, close, and delete.

## [1.8.0] - 2025-11-28

### Added
- **Calendar view** for both the public events page and the dashboard, with month/week/year modes, navigation controls, filter integration, and a click-through event detail modal.

### Changed
- Event status model reworked: events can now be Cancelled (visible with a badge but not accepting RSVPs) versus Deleted (permanently removed). The admin events page groups events into Draft, Open, Closed, Cancelled, and Past sections with status-aware actions and color-coded badges.

## [1.7.1] - 2025-11-27

### Changed
- Lowered platform pricing to 1.5% + 0.25 EUR.

## [1.7.0] - 2025-11-26

### Added
- Email-collection step for Stripe Connect: organizers confirm a business email in a modal before connecting, the connected email is shown in the status banner, and an interrupted setup is recoverable via the pre-filled field.

## [1.6.0] - 2025-11-26

### Changed
- Privacy settings consolidated into General Preferences (renamed from "Attendee List Visibility"), removing the duplicate Privacy Settings section from notification preferences.

## [1.5.7] - 2025-11-25

### Fixed
- Organization admin tabs no longer overlap onto a second row on desktop and landscape mobile.

## [1.5.6] - 2025-11-25

### Fixed
- Multiple organization-admin mobile layout issues: overlapping org name and "Owner" badge, tabs scrolling out of view, and text cutoff in notice boxes.

## [1.5.5] - 2025-11-25

### Fixed
- Improved mobile layout of the organization members and staff admin page.

## [1.5.4] - 2025-11-23

### Fixed
- Social/link previews for the homepage now show the correct Open Graph and Twitter card image.

## [1.5.3] - 2025-11-23

### Fixed
- Corrected the OpenGraph preview image so shared event and organization links render properly on WhatsApp and other social platforms.

## [1.5.2] - 2025-11-23

### Changed
- Updated the OpenGraph preview image used for social link sharing.

## [1.5.1] - 2025-11-23

### Fixed
- Switched the OpenGraph image to PNG so WhatsApp and other social previews display correctly when sharing links.

## [1.5.0] - 2025-11-23

### Added
- **Learn More page**: new marketing page detailing platform pricing and features, linked from the footer.
- Password change section in account security settings, including a password-reset request flow.

## [1.4.0] - 2025-11-22

### Added
- Email verification status badge on the profile, with a one-click option to resend the verification email.

## [1.3.3] - 2025-11-21

### Fixed
- Resolved a crash on the `/dashboard/rsvps` page caused by missing event logo/cover data.
- Organization cards and the dashboard now show clean description text instead of raw markdown.
- Event invitation links created via tokens now correctly carry the "grants invitation" setting.
- Fixed unexpected logouts caused by a token-refresh race condition.
- Attendee lists now show the backend-provided display name for each guest.

## [1.3.1] - 2025-11-21

### Fixed
- Restricted (login-required) events now show a "Login to RSVP" / "Login to Get Tickets" prompt for signed-out users instead of an empty action menu.
- Editing an event no longer silently resets fields that weren't on the current step (full form state is now preserved on save).
- Event and invitation descriptions render as formatted HTML with readable line lengths.

## [1.3.0] - 2025-11-20

### Fixed
- Tags added to or removed from events and organizations in the admin edit form now persist correctly, and the Advanced section auto-expands when tags exist.

## [1.2.1] - 2025-11-20

### Fixed
- Improved event detail page layout consistency: cover images no longer stretch on ultra-wide screens, description text keeps a readable width, and location metadata is no longer hidden behind the organization badge on mobile.

## [1.2.0] - 2025-11-20

### Added
- Preview button on draft event cards so admins can view an event before publishing.

### Fixed
- Enabled secure cookies in production to stop unexpected logouts.

## [1.1.1] - 2025-11-20

### Added
- Telegram connection is now validated before notifications can be enabled.

### Changed
- Account creation now enforces password strength requirements (including special-character rules aligned with the backend) before submission.

## [1.1.0] - 2025-11-20

### Fixed
- Event time edits now preserve the local timezone instead of shifting times.
- Password fields can now be pasted on iOS Safari mobile browsers.
- Removed obsolete "free for members" / "free for staff" event options that no longer applied.

## [1.0.2] - 2025-11-20

### Changed
- Replaced the contact page with a direct mailto link.

### Fixed
- Email verification resend now works with the updated email-based request.

## [1.0.1] - 2025-11-20

### Fixed
- The mobile notification dropdown now keeps the "View all notifications" footer button visible while the list scrolls.

## [1.0.0] - 2025-11-19

### Added
- **Membership tiers & ticket tier restrictions**: organizations can define membership tiers, and ticket tiers can be restricted to specific members — surfaced across org pages, event pages, the dashboard, and member management.
- **Legal pages & compliance onboarding**: new `/legal/privacy` and `/legal/terms` pages, a terms-and-privacy acceptance checkbox on registration, automatic invitation-token claiming from `?ot=`/`?et=` links, and a cookie notice.
- Logo and cover-art fallback hierarchy so events without their own artwork inherit images from their event series or organization across cards, headers, invitations, RSVP cards, and ticket cards.

## [0.x] — Initial development (2025-10-27 – 2025-11-18)

The pre-1.0 series established the foundation of the Revel web app.

### Added
- **Project foundation & design system**: bootstrapped the SvelteKit 5 (Runes) app with shared `PublicLayout`/`AuthLayout` layouts, responsive header, slide-out mobile nav, user menu, light/dark/system theme toggle, skeleton loaders, and accessibility primitives (skip links, focus traps).
- **Authentication**: full account flow — registration, login with two-factor (2FA) support, password reset, and rotating-JWT refresh handled transparently in server hooks; automatic invitation/ticket token claiming on sign-up.
- **Account, profile & GDPR**: user profile editing, a settings page with notification and privacy preferences, personal data export, email unsubscribe via tokenized preference links, and a full GDPR account-deletion flow.
- **Event discovery & detail**: public event listing with search, city filter, and sort controls, plus rich event detail pages showing eligibility state, contextual action buttons, and SEO-optimized social-media previews.
- **RSVP & attendance**: accessible RSVP flow, attendee lists, potluck coordination (item claiming with constraints/warnings), guest RSVP and ticket-purchase flow for non-logged-in users, and dietary preferences/restrictions.
- **Ticketing & payments**: complete ticketing system with Stripe Connect onboarding for organizations and an end-to-end checkout flow, multi-currency support, ticket eligibility checks, QR-code check-in scanning, and ticket/invitation management with iCal export.
- **Questionnaires**: creation and management of event questionnaires plus a participant submission flow with bidirectional event assignment and submission evaluation.
- **Organizations & admin**: organization public profiles and settings, event creation/management with status actions and image editing, members/staff management with role badges, membership-request handling, invitation management, a resources manager, and a waitlist management system.
- **Notifications**: in-app notification bell (with mobile support) and notification-request links.
- **Internationalization**: i18n infrastructure (Paraglide) wired across the app.
- **Infrastructure & demo mode**: Docker build + CI/CD for production deployment, the auto-generated TypeScript API client, and a demo mode (signup→login redirect, feedback link).
