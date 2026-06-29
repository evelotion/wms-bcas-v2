import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  output: "export" as const,
  distDir: "out",
  turbopack: {},
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    if (!isServer) config.resolve.fallback = { fs: false, path: false };
    return config;
  },
};

export default withPWA(nextConfig);