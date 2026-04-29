import type {
  CompletedWork,
  DashboardEvent,
  DashboardMetrics,
  DashboardState,
  FeatureKey,
  MemberUsage,
  ProjectDriveItem,
} from '../types';

const seedTimestamp = (day: number): number => Date.UTC(2026, 3, day);

export const initialDashboardMetrics: DashboardMetrics = {
  sourceLabel: 'demo_mock',
  totalFocusMinutes: 38 * 60 + 45,
  completionRate: 75,
  notificationAdoptionRate: 10,
  deliveryRate: 92,
  teamFeatureUsageRate: 60,
};

// 사용자가 CTA 를 통해 완료한 활동만 표시. seed 데이터는 두지 않음.
const initialCompletedWorks: CompletedWork[] = [];

const initialDriveItems: ProjectDriveItem[] = [
  {
    id: 'drive_seed_1',
    name: '프로젝트개_계획_v0.3.pdf',
    kind: 'file',
    createdAt: seedTimestamp(24),
  },
  {
    id: 'drive_seed_2',
    name: '김개_프로젝트_레퍼런스',
    kind: 'folder',
    createdAt: seedTimestamp(25),
  },
];

const initialMemberUsage: MemberUsage[] = [];
const initialEvents: DashboardEvent[] = [];

export function createInitialDashboardState(): DashboardState {
  return {
    weekRangeLabel: '04.20 - 04.26',
    metrics: { ...initialDashboardMetrics },
    completedWorks: initialCompletedWorks.map((work) => ({ ...work })),
    projectDriveItems: initialDriveItems.map((item) => ({ ...item })),
    memberUsage: initialMemberUsage.map((member) => ({ ...member })),
    events: initialEvents.map((event) => ({ ...event })),
  };
}

export type MetricDeltas = Partial<Omit<DashboardMetrics, 'sourceLabel'>>;

export const ctaDeltas: Record<FeatureKey, MetricDeltas> = {
  team_invite: {
    teamFeatureUsageRate: 15,
    deliveryRate: 3,
  },
  notification_rule: {
    notificationAdoptionRate: 20,
    completionRate: 5,
  },
  note_share: {
    deliveryRate: 5,
  },
};
