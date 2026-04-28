import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { applyCtaToDashboard } from '../domain/dashboard/applyCtaToDashboard';
import { selectRecommendation } from '../domain/recommendation/selectRecommendation';
import type {
  AppState,
  Classification,
  Content,
  ContentType,
  GuideImpression,
} from '../domain/types';
import { invokeMockFeature } from '../services/mockFeatureApi';
import {
  clearPersistedState,
  loadPersistedState,
  savePersistedState,
} from '../services/storage';
import { appReducer, createInitialAppState } from './appReducer';
import { runClassificationFlow } from '../services/classifiers/classificationFlow';

export interface ContentDraft {
  type: ContentType;
  title: string;
  body: string;
  date?: string;
}

export interface AppActions {
  openCreateModal: () => void;
  closeCreateModal: () => void;
  submitContent: (draft: ContentDraft) => Promise<void>;
  acceptCta: () => Promise<void>;
  dismissGuide: () => void;
  neverShowGuide: () => void;
  resetState: () => void;
}

interface AppContextValue {
  state: AppState;
  actions: AppActions;
}

const AppStateContext = createContext<AppContextValue | null>(null);

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadInitialState(): AppState {
  const initial = createInitialAppState();
  const persisted = loadPersistedState();
  if (!persisted) return initial;

  return {
    ...initial,
    user: {
      ...persisted.user,
      // 세션 dismiss 는 영속 제외 — 새로고침 시 항상 빈 배열로 시작 (plan §5.3)
      sessionDismissedGuides: [],
    },
    contents: persisted.contents,
    guideImpressions: persisted.guideImpressions,
    dashboard: persisted.dashboard,
  };
}

interface AppStateProviderProps {
  children: ReactNode;
}

export function AppStateProvider({ children }: AppStateProviderProps) {
  const [state, dispatch] = useReducer(
    appReducer,
    undefined,
    loadInitialState,
  );

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    // sessionDismissedGuides 는 영속 제외 (plan §5.3: 세션 내 dismiss)
    const { sessionDismissedGuides: _ignored, ...persistedUser } = state.user;
    void _ignored;
    savePersistedState({
      user: persistedUser,
      contents: state.contents,
      guideImpressions: state.guideImpressions,
      dashboard: state.dashboard,
    });
  }, [state.user, state.contents, state.guideImpressions, state.dashboard]);

  const openCreateModal = useCallback(() => {
    dispatch({ type: 'OPEN_CREATE_MODAL' });
  }, []);

  const closeCreateModal = useCallback(() => {
    dispatch({ type: 'CLOSE_CREATE_MODAL' });
  }, []);

  const submitContent = useCallback(async (draft: ContentDraft) => {
    const now = Date.now();
    const content: Content = {
      id: generateId('content'),
      type: draft.type,
      title: draft.title,
      body: draft.body,
      date: draft.date,
      createdAt: now,
    };

    dispatch({ type: 'ANALYSIS_STARTED', payload: { content } });

    try {
      const outcome = await runClassificationFlow(
        {
          title: content.title,
          content: content.body,
          type: content.type,
        },
        stateRef.current.user.classifications,
      );

      const currentState = stateRef.current;

      const classification: Classification = {
        contentId: content.id,
        userType: outcome.userType,
        rawUserType: outcome.rawUserType,
        confidence: outcome.confidence,
        reasoning: outcome.reasoning,
        keywords: outcome.keywords,
        source: outcome.source,
        createdAt: Date.now(),
      };

      const recommendation = selectRecommendation({
        userType: classification.userType,
        usedFeatures: currentState.user.usedFeatures,
        dismissedGuides: currentState.user.dismissedGuides,
        sessionDismissedGuides: currentState.user.sessionDismissedGuides,
      });

      dispatch({
        type: 'ANALYSIS_RESOLVED',
        payload: { classification, recommendation },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '분석 중 오류가 발생했습니다.';
      dispatch({ type: 'ANALYSIS_FAILED', payload: { error: message } });
    }
  }, []);

  const acceptCta = useCallback(async () => {
    const currentState = stateRef.current;
    const recommendation = currentState.activeRecommendation;
    if (!recommendation) return;

    const lastContent =
      currentState.contents[currentState.contents.length - 1];
    if (!lastContent) return;

    await invokeMockFeature(recommendation.featureKey);

    const now = Date.now();
    const newDashboard = applyCtaToDashboard({
      dashboard: currentState.dashboard,
      recommendation,
      content: lastContent,
      now,
    });

    const newUsedFeatures = {
      ...currentState.user.usedFeatures,
      [recommendation.featureKey]:
        currentState.user.usedFeatures[recommendation.featureKey] + 1,
    };

    const impression: GuideImpression = {
      guideId: recommendation.guideId,
      contentId: lastContent.id,
      shownAt: now,
      outcome: 'accepted',
    };

    dispatch({
      type: 'GUIDE_ACCEPTED',
      payload: {
        dashboard: newDashboard,
        impression,
        usedFeatures: newUsedFeatures,
        userType: recommendation.userType,
      },
    });
  }, []);

  const dismissGuide = useCallback(() => {
    const recommendation = stateRef.current.activeRecommendation;
    if (!recommendation) return;
    dispatch({
      type: 'GUIDE_DISMISSED',
      payload: { guideId: recommendation.guideId },
    });
  }, []);

  const neverShowGuide = useCallback(() => {
    const recommendation = stateRef.current.activeRecommendation;
    if (!recommendation) return;
    dispatch({
      type: 'GUIDE_NEVER_SHOW',
      payload: { guideId: recommendation.guideId },
    });
  }, []);

  const resetState = useCallback(() => {
    clearPersistedState();
    dispatch({ type: 'RESET_STATE' });
  }, []);

  const actions = useMemo<AppActions>(
    () => ({
      openCreateModal,
      closeCreateModal,
      submitContent,
      acceptCta,
      dismissGuide,
      neverShowGuide,
      resetState,
    }),
    [
      openCreateModal,
      closeCreateModal,
      submitContent,
      acceptCta,
      dismissGuide,
      neverShowGuide,
      resetState,
    ],
  );

  const value = useMemo<AppContextValue>(
    () => ({ state, actions }),
    [state, actions],
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return ctx;
}
