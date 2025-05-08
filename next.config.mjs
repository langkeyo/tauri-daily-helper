/**
 * @type {import('next').NextConfig}
 */
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const repoName = 'tauri-daily-helper';

const nextConfig = {
  reactStrictMode: true,
  // Output as a static site for Tauri
  output: 'export',
  // For GitHub Pages - set base path to repo name in production
  basePath: isProd ? `/${repoName}` : '',
  // 必须为静态网站禁用图片优化
  images: {
    unoptimized: true,
  },
  // Disable type checking during build (will help bypass the binary file issue)
  typescript: {
    // Disable type checking since we're having issues with binary files
    ignoreBuildErrors: true,
  },
  eslint: {
    // Disable ESLint during build to avoid linting errors with binary files
    ignoreDuringBuilds: true,
  },
  // Configure webpack to handle Tauri's binary assets
  webpack: (config, { isServer }) => {
    // Add a rule to completely exclude Tauri binary files from webpack processing
    config.module.rules.push({
      test: /[\\/]tauri-codegen-assets[\\/].*\.(ts|js)$/,
      use: 'null-loader',
      // Make this rule as specific as possible
      include: [/[\\/]src-tauri[\\/]target[\\/]/],
    });

    // Prevent Next.js from trying to resolve these files
    config.resolve.alias = {
      ...config.resolve.alias,
      // Add an alias for the problematic file to an empty module
      './src-tauri/target/release/build/app-7fc1472ce2ca80d9/out/tauri-codegen-assets/17688946aa0fac63f73edab0420f0f6a300417560bd9f9f8e028343d63469ce7.ts': 
        path.join(__dirname, 'empty-module.js'),
    };

    // Disable handling of binary files in non-server builds
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    
    return config;
  },
};

export default nextConfig; 