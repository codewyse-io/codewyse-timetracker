export enum FocusCategory {
  DEEP_FOCUS = 'deep_focus',
  GOOD_FOCUS = 'good_focus',
  MODERATE = 'moderate',
  LOW_FOCUS = 'low_focus',
}

export function getFocusCategory(score: number): FocusCategory {
  if (score >= 90) return FocusCategory.DEEP_FOCUS;
  if (score >= 75) return FocusCategory.GOOD_FOCUS;
  if (score >= 60) return FocusCategory.MODERATE;
  return FocusCategory.LOW_FOCUS;
}
