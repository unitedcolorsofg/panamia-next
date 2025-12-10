/** @type {import('next-sitemap').IConfig} */
export default {
  siteUrl:
    process.env.NEXT_PUBLIC_HOST_URL ||
    process.env.SITE_URL ||
    'https://panamia.club',
  generateRobotsTxt: true,
  changefreq: 'monthly',
  exclude: [
    '/account/*',
    '/admin/*',
    '/api/*',
    '/directory/*',
    '/about-us-old',
    '/index2',
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/account', '/admin', '/api', '/directory'],
      },
    ],
  },
};
