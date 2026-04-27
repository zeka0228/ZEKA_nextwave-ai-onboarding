export type ContentType = 'memo' | 'schedule';

export type UserType =
  | '대학생'
  | '직장인'
  | '프리랜서'
  | '팀 사용자'
  | '개인 사용자';

export type LlmUserType = Exclude<UserType, '개인 사용자'> | 'unknown';

export type FeatureKey =
  | 'team_invite'
  | 'notification_rule'
  | 'note_share';

export interface ClassificationInput {
  title: string;
  content: string;
  type: ContentType;
}

export interface LlmClassificationResult {
  user_type: LlmUserType;
  confidence: number;
  reasoning?: string;
  keywords: string[];
}

export interface FeatureFlags {
  team_invite: number;
  notification_rule: number;
  note_share: number;
}

export interface Content {
  id: string;
  type: ContentType;
  title: string;
  body: string;
  date?: string;
  createdAt: number;
}

export interface Classification {
  contentId: string;
  userType: UserType;
  rawUserType: LlmUserType;
  confidence: number;
  reasoning?: string;
  keywords: string[];
  source: 'mock_classifier' | 'llm_adapter' | 'history_fallback' | 'default_fallback';
  createdAt: number;
}

export interface Recommendation {
  guideId: string;
  userType: UserType;
  featureKey: FeatureKey;
  title: string;
  description: string;
  cta: string;
  reason: string;
}

export interface GuideImpression {
  guideId: string;
  contentId?: string;
  shownAt: number;
  outcome: 'accepted' | 'dismissed' | 'hidden' | 'pending';
}

export interface DashboardMetrics {
  sourceLabel: 'demo_mock';
  totalFocusMinutes: number;
  completionRate: number;
  notificationAdoptionRate: number;
  deliveryRate: number;
  teamFeatureUsageRate: number;
}

export interface CompletedWork {
  id: string;
  label: string;
  kind: 'task' | 'meeting' | 'notification' | 'team_invite';
  createdAt: number;
}

export interface ProjectDriveItem {
  id: string;
  name: string;
  kind: 'file' | 'folder' | 'shared_link';
  createdAt: number;
}

export interface MemberUsage {
  memberId: string;
  name: string;
  focusMinutes: number;
}

export interface DashboardEvent {
  id: string;
  type: 'content_created' | 'classification_done' | 'guide_accepted' | 'feature_used';
  featureKey?: FeatureKey;
  contentId?: string;
  title: string;
  createdAt: number;
}

export interface DashboardState {
  weekRangeLabel: string;
  metrics: DashboardMetrics;
  completedWorks: CompletedWork[];
  projectDriveItems: ProjectDriveItem[];
  memberUsage: MemberUsage[];
  events: DashboardEvent[];
}

export interface UserState {
  userId: string;
  displayName: string;
  userType: UserType | null;
  classifications: Classification[];
  dismissedGuides: string[];
  sessionDismissedGuides: string[];
  usedFeatures: FeatureFlags;
}

export interface AppState {
  user: UserState;
  contents: Content[];
  activeClassification: Classification | null;
  activeRecommendation: Recommendation | null;
  guideImpressions: GuideImpression[];
  dashboard: DashboardState;
  ui: {
    isCreateModalOpen: boolean;
    isAnalyzing: boolean;
    analysisError?: string;
  };
}
