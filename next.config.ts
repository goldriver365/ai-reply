import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Next.js 16.3+ writes Turbopack's persistent build cache to .next/cache/turbopack
    // by default. That cache can end up embedding build-time environment variable
    // values (e.g. OPENAI_API_KEY), which triggers Netlify's secrets scanner on the
    // build output. Netlify's fresh build containers don't restore .next/cache between
    // builds anyway, so this cache provides no benefit here — disable it outright.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
