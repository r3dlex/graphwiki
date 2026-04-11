// URL ingester for GraphWiki v2
// Fetches and extracts content from web URLs

export interface UrlContent {
  url: string;
  title?: string;
  text: string;
  html?: string;
  status: number;
  description: string;
}

/**
 * Fetch content from a URL and extract readable text
 */
export async function fetchUrl(url: string): Promise<UrlContent> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'GraphWiki/2.0 (knowledge-graph-builder)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  const status = response.status;
  const html = await response.text();

  let title: string | undefined;
  let text: string;

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    title = titleMatch[1]?.trim();
  }

  // Strip HTML tags and clean text
  text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

  const description = text.substring(0, 500);

  return { url, title, text, html, status, description };
}

/**
 * Extract content from a URL and convert to graph-friendly format
 */
export async function ingestUrl(url: string): Promise<{
  content: string;
  metadata: Record<string, unknown>;
}> {
  const page = await fetchUrl(url);

  if (page.status !== 200) {
    throw new Error(`Failed to fetch URL: HTTP ${page.status}`);
  }

  const description = page.text.substring(0, 500);

  return {
    content: page.text,
    metadata: {
      source: 'url',
      url: page.url,
      title: page.title,
      description,
      ingested_at: new Date().toISOString(),
    },
  };
}
