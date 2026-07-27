/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AVATARS_50 } from './constants/avatars';

export const AVATARS = AVATARS_50.map((a, idx) => ({
  id: idx + 1,
  avatar_id: a.id,
  url: a.image,
  image: a.image,
  name: a.name,
  pack: idx < 10 ? 'Aesthetic' : idx < 20 ? 'Gamer' : idx < 30 ? 'Anime' : idx < 40 ? 'Cosmic' : 'Legendary'
}));


export const COLORS = {
  primary: "#FF6B6B",
  primaryHover: "#FF7C7C",
  primaryPressed: "#E85A5A",
  primaryLight: "#FFE8E8",
  border: "#FF8A8A",
  shadow: "rgba(255,107,107,0.35)",
  white: "#FFFFFF"
};

