/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // trailingSlash is off: it 308'd inbox POSTs, and remote servers don't follow
  // redirects on POST, so federation deliveries failed silently. The auth
  // conflict it also caused is handled by advanced.skipTrailingSlashes in auth.ts.
  // ActivityPub URLs are published without the trailing slash to match
  // (see lib/federation/index.ts).
};

export default nextConfig;
