import type { RequestHandler } from './$types';

/**
 * OpenSearch description document
 * Enables browsers to add Revel as a search engine
 * https://developer.mozilla.org/en-US/docs/Web/OpenSearch
 * https://github.com/dewitt/opensearch
 */
export const GET: RequestHandler = async ({ url }) => {
	const baseUrl = url.origin;

	const openSearchXml = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>Revel</ShortName>
  <Description>Search for events and organizations on Revel</Description>
  <Tags>events community organizations tickets rsvp</Tags>
  <Contact>contact@letsrevel.io</Contact>
  <Url type="text/html" method="get" template="${baseUrl}/events?search={searchTerms}"/>
  <Url type="application/rss+xml" method="get" template="${baseUrl}/feed.xml"/>
  <LongName>Revel - Community Event Platform</LongName>
  <Image width="16" height="16" type="image/x-icon">${baseUrl}/favicon.ico</Image>
  <Image width="64" height="64" type="image/png">${baseUrl}/favicon.png</Image>
  <Query role="example" searchTerms="music"/>
  <Developer>Revel Team</Developer>
  <Attribution>Event data provided by Revel community organizers</Attribution>
  <SyndicationRight>open</SyndicationRight>
  <AdultContent>false</AdultContent>
  <Language>en</Language>
  <OutputEncoding>UTF-8</OutputEncoding>
  <InputEncoding>UTF-8</InputEncoding>
</OpenSearchDescription>`;

	return new Response(openSearchXml, {
		headers: {
			'Content-Type': 'application/opensearchdescription+xml; charset=utf-8',
			'Cache-Control': 'public, max-age=604800' // Cache for 1 week
		}
	});
};
