# SEO Indexing Guide for Revel Landing Pages

> **Note:** This file is for internal reference only. Do not commit to the repository.

## Overview

This guide covers how to get the new SEO landing pages indexed by Google and improve their search rankings.

## Landing Pages Created

| URL | Target Keywords |
|-----|-----------------|
| `/eventbrite-alternative` | eventbrite alternative, event management platform |
| `/queer-event-management` | queer event management, LGBTQ+ events |
| `/kink-event-ticketing` | kink event ticketing, fetish party management |
| `/self-hosted-event-platform` | self-hosted events, open source event platform |
| `/privacy-focused-events` | privacy-focused events, GDPR compliant ticketing |

Each page is available in 3 languages: English (`/`), German (`/de/`), Italian (`/it/`)

---

## Step 1: Google Search Console Setup

### 1.1 Verify Domain Ownership
1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add property: `https://letsrevel.io` (or your domain)
3. Verify ownership via DNS TXT record or HTML file

### 1.2 Submit Sitemap
1. In Search Console, go to **Sitemaps**
2. Submit: `https://letsrevel.io/sitemap.xml`
3. The sitemap includes all landing pages with proper priorities

### 1.3 Request Indexing (Manual)
For faster indexing of new pages:
1. Go to **URL Inspection** tool
2. Enter each landing page URL
3. Click **Request Indexing**

Priority order for manual submission:
1. `/eventbrite-alternative` (highest search volume)
2. `/self-hosted-event-platform`
3. `/privacy-focused-events`
4. `/queer-event-management`
5. `/kink-event-ticketing`

---

## Step 2: Internal Linking (Already Implemented)

Internal links help Google discover and understand page importance.

### Current Internal Links:
- **Footer**: "Solutions" section links to all 5 landing pages
- **Homepage**: "Use Cases" section with cards linking to landing pages
- Links are locale-aware (German users see `/de/` links)

### Additional Internal Linking Opportunities:
- Blog posts (when created) should link to relevant landing pages
- Event creation flow could mention features with links
- Help/FAQ pages could reference landing pages

---

## Step 3: External Link Building

### 3.1 Directory Submissions
Submit Revel to relevant directories:

**Open Source Directories:**
- [ ] AlternativeTo.net (as Eventbrite alternative)
- [ ] Product Hunt
- [ ] GitHub Awesome lists (awesome-selfhosted, awesome-events)
- [ ] Open Source alternatives directories

**Event Industry:**
- [ ] Capterra
- [ ] G2
- [ ] GetApp
- [ ] Software Advice

**LGBTQ+ / Privacy Focused:**
- [ ] LGBTQ+ tech directories
- [ ] Privacy-focused software lists
- [ ] European software directories (GDPR angle)

### 3.2 Content Marketing
Create content that naturally links to landing pages:

- **Blog posts** comparing Revel to competitors
- **Guest posts** on event management blogs
- **Case studies** from organizations using Revel
- **Press releases** for major features

### 3.3 Community Engagement
- Reddit: r/selfhosted, r/opensource, r/eventplanning
- Hacker News (for self-hosted angle)
- LGBTQ+ community forums
- Event organizer communities

---

## Step 4: Technical SEO Checklist

### Already Implemented:
- [x] Semantic HTML structure
- [x] JSON-LD structured data (WebPage, FAQPage, BreadcrumbList)
- [x] Open Graph meta tags
- [x] Twitter Card meta tags
- [x] Canonical URLs
- [x] Hreflang tags for multi-language
- [x] XML Sitemap with all pages
- [x] RSS feed (`/feed.xml`)
- [x] OpenSearch (`/opensearch.xml`)
- [x] Robots.txt with sitemap reference
- [x] Mobile-responsive design

### To Verify:
- [ ] Page load speed < 3 seconds
- [ ] Core Web Vitals passing
- [ ] No broken links
- [ ] Images have alt text
- [ ] HTTPS everywhere

### Check with Tools:
- [PageSpeed Insights](https://pagespeed.web.dev/)
- [Rich Results Test](https://search.google.com/test/rich-results)
- [Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)

---

## Step 5: Monitor & Iterate

### Weekly Tasks:
1. Check Search Console for crawl errors
2. Monitor impressions/clicks for landing pages
3. Review search queries driving traffic

### Monthly Tasks:
1. Analyze which pages are ranking
2. Update content based on search query data
3. Add new internal links from new content
4. Check competitor rankings

### Key Metrics to Track:
- **Impressions**: Are pages appearing in search?
- **Clicks**: Are titles/descriptions compelling?
- **Average Position**: Where do pages rank?
- **CTR**: Click-through rate optimization

---

## Step 6: Content Optimization Tips

### Title Tags (Already Set):
- Include primary keyword near the beginning
- Keep under 60 characters
- Make compelling for clicks

### Meta Descriptions (Already Set):
- Include primary + secondary keywords
- Clear value proposition
- Call to action
- Keep under 155 characters

### On-Page Content:
- H1 contains primary keyword
- H2s contain related keywords
- First paragraph mentions key terms
- FAQ section targets long-tail queries
- Internal links to related pages

---

## Expected Timeline

| Milestone | Timeframe |
|-----------|-----------|
| Pages crawled | 1-2 weeks |
| Initial indexing | 2-4 weeks |
| First rankings (long-tail) | 1-2 months |
| Competitive rankings | 3-6 months |
| Established authority | 6-12 months |

---

## Quick Links

- [Google Search Console](https://search.google.com/search-console)
- [Sitemap](https://letsrevel.io/sitemap.xml)
- [Robots.txt](https://letsrevel.io/robots.txt)
- [RSS Feed](https://letsrevel.io/feed.xml)
- [Rich Results Test](https://search.google.com/test/rich-results)
- [PageSpeed Insights](https://pagespeed.web.dev/)

---

## Notes

- Google indexing takes time - be patient
- Quality backlinks matter more than quantity
- Content freshness helps - consider updating pages periodically
- Monitor competitors' strategies
- Focus on user experience, not just SEO tricks
