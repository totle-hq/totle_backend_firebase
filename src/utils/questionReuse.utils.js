// utils/questionReuse.utils.js
import { getDistance } from "geolib";

/**
 * Shuffle an array
 */
export function shuffle(array) {
  return array
    .map((val) => ({ val, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ val }) => val);
}

/**
 * Pick N random items from an array
 */
export function getRandomSubset(array, count) {
  return shuffle(array).slice(0, count);
}

/**
 * Check if two locations are farther apart than threshold (in km)
 */
export function isFarAway(loc1, loc2, thresholdKm = 10) {
  if (!loc1 || !loc2) return false;
  const dist = getDistance(
    { latitude: loc1.lat, longitude: loc1.lng },
    { latitude: loc2.lat, longitude: loc2.lng }
  );
  return dist > thresholdKm * 1000;
}
