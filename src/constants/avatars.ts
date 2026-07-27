/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AvatarData {
  id: string;
  name: string;
  image: string;
  url: string; // compatibility alias for image
  style?: string;
}

export const AVATARS_50: AvatarData[] = Array.from({ length: 50 }, (_, i) => {
  const num = i + 1;
  const image = `https://raw.githubusercontent.com/zavrinfo-arch/Avatars/main/Avatar${num}.png`;
  return {
    id: `avatar_${num}`,
    name: `Avatar ${num}`,
    image,
    url: image,
    style: num <= 15 ? 'collection_1' : num <= 30 ? 'collection_2' : num <= 40 ? 'collection_3' : 'collection_4',
  };
});

// Mapping for quick lookup by ID
export const avatarMap: Record<string, string> = AVATARS_50.reduce((acc, avatar) => {
  acc[avatar.id] = avatar.image;
  return acc;
}, {} as Record<string, string>);

/**
 * Helper to extract numeric ID index (1-50) from avatar ID or URL
 */
export function getAvatarIndex(avatarIdOrUrl?: string | null): number {
  if (!avatarIdOrUrl) return 1;
  const match = avatarIdOrUrl.match(/Avatar(\d+)\.png/i) || avatarIdOrUrl.match(/(\d+)/);
  if (match) {
    const parsed = parseInt(match[1], 10);
    if (!isNaN(parsed) && parsed >= 1) {
      return ((parsed - 1) % 50) + 1;
    }
  }
  return 1;
}

/**
 * Resolves an avatar ID or URL to a valid GitHub Raw avatar URL.
 * Never returns empty, broken, or Dicebear URLs.
 */
export function getAvatarUrl(avatarIdOrUrl?: string | null, seedFallback: number | string = 1): string {
  if (!avatarIdOrUrl) {
    const idx = typeof seedFallback === 'number' 
      ? (((seedFallback - 1) % 50) + 1)
      : (Math.abs(hashString(seedFallback)) % 50) + 1;
    return `https://raw.githubusercontent.com/zavrinfo-arch/Avatars/main/Avatar${idx}.png`;
  }

  // If already a valid GitHub avatar URL from our repo
  if (avatarIdOrUrl.includes('raw.githubusercontent.com/zavrinfo-arch/Avatars/main/Avatar')) {
    return avatarIdOrUrl;
  }

  // Parse numeric component from old IDs or URLs (e.g., "avatar_15", "genz_5", "12", "classic_2")
  const match = avatarIdOrUrl.match(/Avatar(\d+)/i) || avatarIdOrUrl.match(/\d+/);
  if (match) {
    const parsed = parseInt(match[0].replace(/\D/g, ''), 10);
    if (!isNaN(parsed) && parsed >= 1) {
      const idx = ((parsed - 1) % 50) + 1;
      return `https://raw.githubusercontent.com/zavrinfo-arch/Avatars/main/Avatar${idx}.png`;
    }
  }

  // Fallback hash based on string seed
  const idx = (Math.abs(hashString(avatarIdOrUrl)) % 50) + 1;
  return `https://raw.githubusercontent.com/zavrinfo-arch/Avatars/main/Avatar${idx}.png`;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

