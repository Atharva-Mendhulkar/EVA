// Central environment plumbing. Frontend reads NEXT_PUBLIC_* (baked at Vercel
// build time); backend reads server vars. No AWS secrets ever touch Vercel.

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export const DEMO_MODE =
  (process.env.NEXT_PUBLIC_DEMO_MODE ?? process.env.DEMO_MODE ?? 'true') !== 'false';

export const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 86400);

export const MAX_DOCUMENT_SIZE_MB = Number(process.env.MAX_DOCUMENT_SIZE_MB || 10);

/** Prefixes same-origin API paths with the deployed backend when configured. */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
