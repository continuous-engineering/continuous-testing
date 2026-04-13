/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // All pages are dynamic (Clerk requires runtime auth context)
  // This prevents static pre-render failures when Clerk keys aren't valid at build time
  staticPageGenerationTimeout: 10,
}

module.exports = nextConfig
