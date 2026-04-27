import { createInitialDashboardState } from '../domain/dashboard/mockDashboardMetrics';
import type {
  AppState,
  Classification,
  Content,
  DashboardState,
  FeatureFlags,
  GuideImpression,
  Recommendation,
  UserType,
} from '../domain/types';

export type AppAction =
  | { type: 'OPEN_CREATE_MODAL' }
  | { type: 'CLOSE_CREATE_MODAL' }
  | { type: 'ANALYSIS_STARTED'; payload: { content: Content } }
  | {
      type: 'ANALYSIS_RESOLVED';
      payload: {
        classification: Classification;
        recommendation: Recommendation | null;
      };
    }
  | { type: 'ANALYSIS_FAILED'; payload: { error: string } }
  | {
      type: 'GUIDE_ACCEPTED';
      payload: {
        dashboard: DashboardState;
        impression: GuideImpression;
        usedFeatures: FeatureFlags;
        userType: UserType;
      };
    }
  | { type: 'GUIDE_DISMISSED'; payload: { guideId: string } }
  | { type: 'GUIDE_NEVER_SHOW'; payload: { guideId: string } }
  | { type: 'RESET_STATE' };

export function createInitialAppState(): AppState {
  return {
    user: {
      userId: 'demo_user',
      displayName: '김개발01',
      userType: null,
      classifications: [],
      dismissedGuides: [],
      sessionDismissedGuides: [],
      usedFeatures: {
        team_invite: 0,
        notification_rule: 0,
        note_share: 0,
      },
    },
    contents: [],
    activeClassification: null,
    activeRecommendation: null,
    guideImpressions: [],
    dashboard: createInitialDashboardState(),
    ui: {
      isCreateModalOpen: false,
      isAnalyzing: false,
    },
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'OPEN_CREATE_MODAL':
      return {
        ...state,
        ui: { ...state.ui, isCreateModalOpen: true, analysisError: undefined },
      };

    case 'CLOSE_CREATE_MODAL':
      return {
        ...state,
        ui: { ...state.ui, isCreateModalOpen: false },
      };

    case 'ANALYSIS_STARTED':
      return {
        ...state,
        contents: [...state.contents, action.payload.content],
        ui: {
          ...state.ui,
          isCreateModalOpen: false,
          isAnalyzing: true,
          analysisError: undefined,
        },
      };

    case 'ANALYSIS_RESOLVED': {
      const { classification, recommendation } = action.payload;
      const impression: GuideImpression | null = recommendation
        ? {
            guideId: recommendation.guideId,
            contentId: classification.contentId,
            shownAt: classification.createdAt,
            outcome: 'pending',
          }
        : null;

      return {
        ...state,
        user: {
          ...state.user,
          userType: classification.userType,
          classifications: [...state.user.classifications, classification],
        },
        activeClassification: classification,
        activeRecommendation: recommendation,
        guideImpressions: impression
          ? [...state.guideImpressions, impression]
          : state.guideImpressions,
        ui: { ...state.ui, isAnalyzing: false },
      };
    }

    case 'ANALYSIS_FAILED':
      return {
        ...state,
        ui: {
          ...state.ui,
          isAnalyzing: false,
          analysisError: action.payload.error,
        },
      };

    case 'GUIDE_ACCEPTED': {
      const { dashboard, impression, usedFeatures, userType } = action.payload;
      return {
        ...state,
        user: {
          ...state.user,
          userType,
          usedFeatures,
        },
        dashboard,
        guideImpressions: state.guideImpressions.map((imp) =>
          imp.guideId === impression.guideId && imp.outcome === 'pending'
            ? impression
            : imp,
        ),
        activeRecommendation: null,
      };
    }

    case 'GUIDE_DISMISSED':
      return {
        ...state,
        user: {
          ...state.user,
          sessionDismissedGuides: [
            ...state.user.sessionDismissedGuides,
            action.payload.guideId,
          ],
        },
        guideImpressions: state.guideImpressions.map((imp) =>
          imp.guideId === action.payload.guideId && imp.outcome === 'pending'
            ? { ...imp, outcome: 'dismissed' }
            : imp,
        ),
        activeRecommendation: null,
      };

    case 'RESET_STATE':
      return createInitialAppState();

    case 'GUIDE_NEVER_SHOW':
      return {
        ...state,
        user: {
          ...state.user,
          dismissedGuides: [
            ...state.user.dismissedGuides,
            action.payload.guideId,
          ],
        },
        guideImpressions: state.guideImpressions.map((imp) =>
          imp.guideId === action.payload.guideId && imp.outcome === 'pending'
            ? { ...imp, outcome: 'hidden' }
            : imp,
        ),
        activeRecommendation: null,
      };

    default: {
      const exhaustive: never = action;
      throw new Error(
        `Unhandled action: ${(exhaustive as AppAction).type}`,
      );
    }
  }
}
