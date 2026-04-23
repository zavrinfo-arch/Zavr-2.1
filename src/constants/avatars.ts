/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AvatarData {
  id: string;
  url: string;
  style: 'gen-z' | 'classic' | 'bw' | 'minimal';
}

const DICEBEAR_URL = 'https://api.dicebear.com/7.x/lorelei/svg?seed=';

export const AVATARS_50: AvatarData[] = [
  // GEN-Z MODERN (20)
  ...Array.from({ length: 20 }, (_, i) => ({
    id: `genz_${i + 1}`,
    url: `${DICEBEAR_URL}genz_${i + 1}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`,
    style: 'gen-z' as const
  })),
  // CLASSIC PREMIUM (10)
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `classic_${i + 1}`,
    url: `${DICEBEAR_URL}classic_${i + 1}&backgroundColor=f0f0f0,e0e0e0&skinColor=f8d9ce,feeeea`,
    style: 'classic' as const
  })),
  // BLACK & WHITE (10)
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `bw_${i + 1}`,
    url: `${DICEBEAR_URL}bw_${i + 1}&grayscale=true&backgroundColor=ffffff,000000`,
    style: 'bw' as const
  })),
  // SINGLE-COLOR MINIMAL (10)
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `minimal_${i + 1}`,
    url: `${DICEBEAR_URL}minimal_${i + 1}&backgroundColor=${['3b82f6', 'ef4444', 'a855f7', '10b981', 'f59e0b'][i % 5]}`,
    style: 'minimal' as const
  })),
];

// Mapping for React Native "require" equivalent in Web
export const avatarMap: Record<string, string> = AVATARS_50.reduce((acc, avatar) => {
  acc[avatar.id] = avatar.url;
  return acc;
}, {} as Record<string, string>);
