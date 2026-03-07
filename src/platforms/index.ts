import type { Platform, HostingPlatform } from "../types.js";
import { NetlifyPlatform } from "./netlify.js";
import { VercelPlatform } from "./vercel.js";
import { CloudflarePlatform } from "./cloudflare.js";

export const PLATFORMS: Record<HostingPlatform, Platform> = {
  netlify: NetlifyPlatform,
  vercel: VercelPlatform,
  cloudflare: CloudflarePlatform,
};

export function getPlatform(platform: HostingPlatform): Platform {
  return PLATFORMS[platform];
}

export const PLATFORM_CHOICES: Array<{ name: string; value: HostingPlatform }> = [
  { name: "Netlify", value: "netlify" },
  { name: "Vercel", value: "vercel" },
  { name: "Cloudflare Workers", value: "cloudflare" },
];
