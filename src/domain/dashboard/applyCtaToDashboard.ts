import type {
  CompletedWork,
  Content,
  DashboardEvent,
  DashboardMetrics,
  DashboardState,
  ProjectDriveItem,
  Recommendation,
} from '../types';
import { ctaDeltas, type MetricDeltas } from './mockDashboardMetrics';

export interface ApplyCtaParams {
  dashboard: DashboardState;
  recommendation: Recommendation;
  content: Content;
  now: number;
}

type RateField =
  | 'completionRate'
  | 'notificationAdoptionRate'
  | 'deliveryRate'
  | 'teamFeatureUsageRate';

const RATE_FIELDS: RateField[] = [
  'completionRate',
  'notificationAdoptionRate',
  'deliveryRate',
  'teamFeatureUsageRate',
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function applyDeltas(
  metrics: DashboardMetrics,
  deltas: MetricDeltas,
): DashboardMetrics {
  const result: DashboardMetrics = { ...metrics };

  if (deltas.totalFocusMinutes !== undefined) {
    result.totalFocusMinutes = Math.max(
      0,
      result.totalFocusMinutes + deltas.totalFocusMinutes,
    );
  }

  for (const field of RATE_FIELDS) {
    const delta = deltas[field];
    if (delta !== undefined) {
      result[field] = clamp(result[field] + delta, 0, 100);
    }
  }

  return result;
}

function applyTeamInvite(params: ApplyCtaParams): DashboardState {
  const { dashboard, content, now } = params;

  const newWork: CompletedWork = {
    id: `work_${now}`,
    label: '팀 초대 완료',
    kind: 'team_invite',
    createdAt: now,
  };

  const event: DashboardEvent = {
    id: `event_${now}`,
    type: 'feature_used',
    featureKey: 'team_invite',
    contentId: content.id,
    title: `[팀 초대] ${content.title}`,
    createdAt: now,
  };

  return {
    ...dashboard,
    metrics: applyDeltas(dashboard.metrics, ctaDeltas.team_invite),
    completedWorks: [...dashboard.completedWorks, newWork],
    events: [...dashboard.events, event],
  };
}

function applyNotificationRule(params: ApplyCtaParams): DashboardState {
  const { dashboard, content, now } = params;

  const newWork: CompletedWork = {
    id: `work_${now}`,
    label: '알림 규칙 생성',
    kind: 'notification',
    createdAt: now,
  };

  const event: DashboardEvent = {
    id: `event_${now}`,
    type: 'feature_used',
    featureKey: 'notification_rule',
    contentId: content.id,
    title: `[알림 규칙] ${content.title}`,
    createdAt: now,
  };

  return {
    ...dashboard,
    metrics: applyDeltas(dashboard.metrics, ctaDeltas.notification_rule),
    completedWorks: [...dashboard.completedWorks, newWork],
    events: [...dashboard.events, event],
  };
}

function applyNoteShare(params: ApplyCtaParams): DashboardState {
  const { dashboard, content, now } = params;

  const newDriveItem: ProjectDriveItem = {
    id: `drive_${now}`,
    name: `${content.title} (공유 링크)`,
    kind: 'shared_link',
    createdAt: now,
  };

  const event: DashboardEvent = {
    id: `event_${now}`,
    type: 'feature_used',
    featureKey: 'note_share',
    contentId: content.id,
    title: `[메모 공유] ${content.title}`,
    createdAt: now,
  };

  return {
    ...dashboard,
    metrics: applyDeltas(dashboard.metrics, ctaDeltas.note_share),
    projectDriveItems: [...dashboard.projectDriveItems, newDriveItem],
    events: [...dashboard.events, event],
  };
}

export function applyCtaToDashboard(params: ApplyCtaParams): DashboardState {
  switch (params.recommendation.featureKey) {
    case 'team_invite':
      return applyTeamInvite(params);
    case 'notification_rule':
      return applyNotificationRule(params);
    case 'note_share':
      return applyNoteShare(params);
    default: {
      const exhaustive: never = params.recommendation.featureKey;
      throw new Error(`Unhandled featureKey: ${exhaustive as string}`);
    }
  }
}
