/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  basePath: process.env.NODE_ENV === 'production' ? '/vscode-chat-logs' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/vscode-chat-logs/' : '',
};

module.exports = nextConfig;
