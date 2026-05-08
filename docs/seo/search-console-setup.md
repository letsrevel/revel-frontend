# Search Console & Bing Webmaster setup

1. Visit https://search.google.com/search-console and add `https://letsrevel.io`.
2. Choose "HTML tag" verification. Copy the `content="..."` value.
3. Set `PUBLIC_GOOGLE_SITE_VERIFICATION=<value>` in the production env (`.env.production`).
4. Redeploy. Once `<meta name="google-site-verification">` is live, click Verify in Search Console.
5. Submit the sitemap: `https://letsrevel.io/sitemap.xml`.

For Bing Webmaster Tools:
1. Visit https://www.bing.com/webmasters and add `https://letsrevel.io`.
2. Choose XML verification or HTML meta tag. For meta tag, use `PUBLIC_BING_SITE_VERIFICATION`.
3. Submit `https://letsrevel.io/sitemap.xml`.

## IndexNow

The site exposes `/indexnow-<key>.txt` and a server endpoint `/api/indexnow`. See `docs/seo/indexnow.md`.
