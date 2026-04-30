type AuthView = 'welcome' | 'login' | 'signup';

interface AuthScreensProps {
  view: AuthView;
  onNavigate: (view: AuthView) => void;
  onAuthenticated: () => void;
}

export function AuthScreens({ view, onNavigate, onAuthenticated }: AuthScreensProps) {
  if (view === 'welcome') {
    return <WelcomeScreen onNavigate={onNavigate} />;
  }
  if (view === 'login') {
    return (
      <OAuthScreen
        mode="login"
        onAuthenticated={onAuthenticated}
        onNavigate={onNavigate}
      />
    );
  }
  return (
    <OAuthScreen
      mode="signup"
      onAuthenticated={onAuthenticated}
      onNavigate={onNavigate}
    />
  );
}

function WelcomeScreen({
  onNavigate,
}: {
  onNavigate: (view: AuthView) => void;
}) {
  return (
    <main className="auth-shell">
      <section className="auth-card auth-card-welcome">
        <p className="eyebrow">NextWave AI Onboarding</p>
        <h1 className="auth-title">AI와 함께하는 더 나은 업무 경험</h1>
        <p className="auth-subtitle">
          메모와 일정을 분석하고, 당신에게 맞는 다음 단계를 제안합니다.
        </p>
        <div className="auth-actions">
          <button
            className="primary-button auth-cta"
            type="button"
            onClick={() => onNavigate('login')}
          >
            로그인
          </button>
          <button
            className="ghost-button auth-cta"
            type="button"
            onClick={() => onNavigate('signup')}
          >
            회원가입
          </button>
        </div>
      </section>
    </main>
  );
}

function OAuthScreen({
  mode,
  onAuthenticated,
  onNavigate,
}: {
  mode: 'login' | 'signup';
  onAuthenticated: () => void;
  onNavigate: (view: AuthView) => void;
}) {
  const isLogin = mode === 'login';
  const title = isLogin ? '로그인' : '회원가입';
  const verb = isLogin ? '로그인' : '회원가입';
  const altLabel = isLogin
    ? '아직 계정이 없으신가요?'
    : '이미 계정이 있으신가요?';
  const altCta = isLogin ? '회원가입' : '로그인';
  const altView: AuthView = isLogin ? 'signup' : 'login';

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <button
          className="auth-back"
          type="button"
          onClick={() => onNavigate('welcome')}
          aria-label="뒤로"
        >
          ←
        </button>
        <p className="eyebrow">NextWave AI Onboarding</p>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-subtitle">소셜 계정으로 간편하게 시작하세요.</p>

        <div className="auth-actions">
          <button
            className="oauth-button oauth-button-google"
            type="button"
            onClick={onAuthenticated}
          >
            <span className="oauth-icon" aria-hidden>
              G
            </span>
            <span>구글로 {verb}</span>
          </button>
          <button
            className="oauth-button oauth-button-kakao"
            type="button"
            onClick={onAuthenticated}
          >
            <span className="oauth-icon oauth-icon-kakao" aria-hidden>
              K
            </span>
            <span>카카오로 {verb}</span>
          </button>
        </div>

        <p className="auth-alt">
          {altLabel}{' '}
          <button
            className="auth-link"
            type="button"
            onClick={() => onNavigate(altView)}
          >
            {altCta}
          </button>
        </p>
      </section>
    </main>
  );
}
