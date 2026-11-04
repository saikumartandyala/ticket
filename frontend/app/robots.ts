import type { MetadataRoute } from 'next';
import { IS_INDEXABLE_DEPLOYMENT, SITE_URL } from '../lib/seo';

/**
 * /robots.txt. Preview and local deployments block everything.
 *
 * Private pages (admin, dashboard, chat, sign-in, sell form) are NOT listed
 * here on purpose: they carry a noindex tag, and Google can only see that tag
 * if it may crawl the page (a robots.txt block would let the bare URL get
 * indexed). They're protected by sign-in; robots.txt is not access control.
 * Only endless search / sort / price-filter URL variations are blocked.
 */
export default function robots(): MetadataRoute.Robots {
  if (!IS_INDEXABLE_DEPLOYMENT) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/*?*query=', '/*?*sort=', '/*?*max='],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
