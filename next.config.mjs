import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

// `next dev` でも Cloudflare のバインディング(env など)にアクセスできるようにする
initOpenNextCloudflareForDev();

export default nextConfig;
