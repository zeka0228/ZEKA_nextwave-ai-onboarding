import type {
  FeatureFlags,
  FeatureKey,
  Recommendation,
  UserType,
} from '../types';
import { guideCatalog } from './guideCatalog';

const globalFeaturePriority: FeatureKey[] = [
  'team_invite',
  'notification_rule',
  'note_share',
];

export interface SelectRecommendationParams {
  userType: UserType;
  usedFeatures: FeatureFlags;
  dismissedGuides: string[];
  sessionDismissedGuides: string[];
}

function canShowGuide(
  guide: Recommendation,
  params: SelectRecommendationParams,
): boolean {
  if (params.dismissedGuides.includes(guide.guideId)) return false;
  if (params.sessionDismissedGuides.includes(guide.guideId)) return false;
  if (params.usedFeatures[guide.featureKey] > 0) return false;
  return true;
}

function findGuideByFeature(
  userType: UserType,
  featureKey: FeatureKey,
): Recommendation | null {
  const userGuides = guideCatalog[userType];
  const userMatch = userGuides.find((guide) => guide.featureKey === featureKey);
  if (userMatch) return userMatch;

  for (const guides of Object.values(guideCatalog)) {
    const match = guides.find((guide) => guide.featureKey === featureKey);
    if (match) return match;
  }

  return null;
}

export function selectRecommendation(
  params: SelectRecommendationParams,
): Recommendation | null {
  const primary = guideCatalog[params.userType][0];

  if (primary && canShowGuide(primary, params)) {
    return primary;
  }

  for (const featureKey of globalFeaturePriority) {
    if (params.usedFeatures[featureKey] > 0) continue;
    const candidate = findGuideByFeature(params.userType, featureKey);
    if (candidate && canShowGuide(candidate, params)) {
      return candidate;
    }
  }

  return null;
}
