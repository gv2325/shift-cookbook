/**
 * Content and data for the landing page, taken from the WRI India StoryMap
 * "Streets That Move Cities" that shift-transport.org/citystories embeds,
 * and from the SHIFT charts that story embeds (shift-transport.org/charts/chart-N/embed).
 * Retrieved 2026-11-08.
 */

export const STORY = {
  title: 'Streets That Move Cities',
  subtitle: 'Five transport shifts Indian cities need now',
  byline: 'WRI India Geo Analytics',
  url: 'https://storymaps.arcgis.com/stories/af65c76c19f34309b0d0e7b586fa2bcf',
} as const;

// Images stay on ArcGIS (owned by WRI India) and are linked, not copied into this repo.
const RESOURCES = 'https://www.arcgis.com/sharing/rest/content/items/af65c76c19f34309b0d0e7b586fa2bcf/resources';

export const IMAGES = {
  cover: {
    src: `${RESOURCES}/obFXAi_5ZhGzLqwCWykea.jpg`,
    alt: 'A busy Kolkata street seen from above, with yellow taxis, blue and white buses, tram tracks and crowds of people on foot.',
    credit: 'Photo: WRI India, from “Streets That Move Cities”',
  },
  jaipurCoimbatore: {
    src: `${RESOURCES}/9jhM4nQHP-4t6Zdqzm8yr.png`,
    alt: 'Maps of 15-minute travel areas from central Jaipur (C-Scheme) and Coimbatore (Saibaba Colony) at 3 AM and 7 PM. Jaipur shrinks from 115.7 to 33.2 square kilometres; Coimbatore from 91.6 to 35.9.',
    credit: 'Map: WRI India Geo Analytics',
    width: 843,
    height: 488,
  },
  bengaluru: {
    src: `${RESOURCES}/42TEon-9ud2vfQk4vE2v7.png`,
    alt: 'Two Bengaluru street maps. From Basavanagudi a 3 km straight-line trip is 3.4 km by road with a 400 m detour; from Whitefield it is 4.7 km with a 1,700 m detour.',
    credit: 'Map: WRI India Geo Analytics',
    width: 843,
    height: 488,
  },
} as const;

/** Free-flow (3 AM) vs peak-hour speed in km/h, driving 1 km. Source: SHIFT charts 8 and 9. */
export type SpeedRow = { city: string; free: number; peak: number };

export const PEAK_TIER1: SpeedRow[] = [
  { city: 'Delhi', free: 46, peak: 19 },
  { city: 'Hyderabad', free: 40, peak: 15 },
  { city: 'Pune', free: 36, peak: 15 },
  { city: 'Mumbai', free: 40, peak: 13 },
  { city: 'Bengaluru', free: 38, peak: 13 },
  { city: 'Ahmedabad', free: 34, peak: 12 },
  { city: 'Chennai', free: 34, peak: 12 },
  { city: 'Kolkata', free: 29, peak: 11 },
];

export const PEAK_TIER2: SpeedRow[] = [
  { city: 'Thrissur', free: 33, peak: 18 },
  { city: 'Kozhikode', free: 33, peak: 16 },
  { city: 'Lucknow', free: 36, peak: 15 },
  { city: 'Bhopal', free: 32, peak: 15 },
  { city: 'Surat', free: 32, peak: 15 },
  { city: 'Jaipur', free: 38, peak: 14 },
  { city: 'Nagpur', free: 33, peak: 14 },
  { city: 'Coimbatore', free: 32, peak: 14 },
  { city: 'Kanpur', free: 31, peak: 14 },
  { city: 'Kochi', free: 34, peak: 13 },
  { city: 'Patna', free: 30, peak: 13 },
  { city: 'Indore', free: 31, peak: 12 },
];

/** Share of road length (%) by carriageway width, Tier 1. Source: SHIFT chart 10. */
export type WidthRow = { city: string; shares: [number, number, number, number] };
export const WIDTH_BANDS = ['Under 10 m', '10–20 m', '20–35 m', 'Over 35 m'] as const;

export const ROAD_WIDTH_TIER1: WidthRow[] = [
  { city: 'Hyderabad', shares: [95.4, 2.1, 1.6, 1.0] },
  { city: 'Kolkata', shares: [93.7, 4.4, 1.6, 0.3] },
  { city: 'Chennai', shares: [92.0, 4.9, 2.5, 0.6] },
  { city: 'Delhi', shares: [91.9, 5.2, 1.8, 1.1] },
  { city: 'Pune', shares: [89.8, 6.9, 2.8, 0.5] },
  { city: 'Bengaluru', shares: [86.5, 10.0, 2.5, 0.9] },
  { city: 'Ahmedabad', shares: [81.5, 12.5, 3.9, 2.1] },
  { city: 'Mumbai', shares: [63.8, 28.2, 6.8, 1.2] },
];
