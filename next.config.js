/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  basePath: process.env.NODE_ENV === 'production' ? '/copilot-log-viewer' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/copilot-log-viewer/' : '',
};

module.exports = nextConfig;
