import type {
  Content,
  DashboardState,
  GuideImpression,
  UserState,
} from '../domain/types';

const STORAGE_KEY = 'nextwave-ai-onboarding:v1';

export interface PersistedAppState {
  user: UserState;
  contents: Content[];
  guideImpressions: GuideImpression[];
  dashboard: DashboardState;
}

export function loadPersistedState(): PersistedAppState | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedAppState;
  } catch (error) {
    console.warn('[storage] load failed; starting fresh.', error);
    return null;
  }
}

export function savePersistedState(state: PersistedAppState): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('[storage] save failed.', error);
  }
}

export function clearPersistedState(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
