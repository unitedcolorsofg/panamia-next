/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.SITE_URL || 'https://panamia.club',
  generateRobotsTxt: true,
  exclude: [
    '/account/*',
    '/admin/*',
    '/api/*',
    '/directory/*',
    '/about-us-old',
    '/index2'
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/account', '/admin', '/api', '/directory']
      }
    ]
  }
}
