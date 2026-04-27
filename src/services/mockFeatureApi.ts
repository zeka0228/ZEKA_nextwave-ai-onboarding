import type { FeatureKey } from '../domain/types';

export interface FeatureApiResult {
  ok: true;
  featureKey: FeatureKey;
  resourceId: string;
  createdAt: number;
}

const ARTIFICIAL_DELAY_MS = 250;

const resourcePrefix: Record<FeatureKey, string> = {
  team_invite: 'invite',
  notification_rule: 'rule',
  note_share: 'share',
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function invoke(featureKey: FeatureKey): Promise<FeatureApiResult> {
  await delay(ARTIFICIAL_DELAY_MS);

  const createdAt = Date.now();
  return {
    ok: true,
    featureKey,
    resourceId: `${resourcePrefix[featureKey]}_${createdAt}`,
    createdAt,
  };
}

export const mockFeatureApi = {
  async inviteTeamMember(): Promise<FeatureApiResult> {
    return invoke('team_invite');
  },
  async createNotificationRule(): Promise<FeatureApiResult> {
    return invoke('notification_rule');
  },
  async createShareLink(): Promise<FeatureApiResult> {
    return invoke('note_share');
  },
};

export async function invokeMockFeature(
  featureKey: FeatureKey,
): Promise<FeatureApiResult> {
  return invoke(featureKey);
}
