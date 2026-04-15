import { SCORE_ITEMS } from '../constants/config';

export const SCORE_KEYS = SCORE_ITEMS.map((item) => item.key);

const EMPTY_SCORES = SCORE_KEYS.reduce((acc, key) => {
  acc[key] = 0;
  return acc;
}, {});

export function normalizeScores(rawScores = {}) {
  const normalized = { ...EMPTY_SCORES };
  normalized.structure = rawScores?.structure ?? rawScores?.inspiration ?? 0;
  normalized.fluency = rawScores?.fluency ?? 0;
  normalized.professionalism = rawScores?.professionalism ?? 0;
  normalized.visualDesign = rawScores?.visualDesign ?? rawScores?.visual ?? 0;
  return normalized;
}

export function calculateAverageScore(rawScores = {}) {
  const scores = normalizeScores(rawScores);
  const total = SCORE_KEYS.reduce((sum, key) => sum + (scores[key] || 0), 0);
  return SCORE_KEYS.length ? total / SCORE_KEYS.length : 0;
}

export function toSearchableLower(value) {
  return String(value ?? '').toLowerCase();
}

export function buildLeaderboardKey(rating = {}) {
  if (rating.presentationKey) {
    return rating.presentationKey;
  }

  return [
    rating.roomId || '',
    rating.session || '',
    rating.time || '',
    rating.presenter || '',
    rating.topic || '',
  ].join('||');
}
