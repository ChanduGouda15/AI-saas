// client/src/utils/plan.js
// Normalizes Clerk metadata to a single string: 'premium' | 'free'
export const getNormalizedPlan = (user) => {
  const raw = (
    user?.publicMetadata?.plan ??
    user?.privateMetadata?.plan ??
    ''
  )
    .toString()
    .trim()
    .toLowerCase();

  // Accept common synonyms you might set elsewhere
  if (['premium', 'pro', 'paid'].includes(raw)) return 'premium';
  return 'free';
};
