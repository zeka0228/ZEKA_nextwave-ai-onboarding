import { useState } from 'react';
import { AppStateProvider } from './app/AppStateProvider';
import { AuthScreens } from './screens/AuthScreens';
import { DashboardScreen } from './screens/DashboardScreen';

type AuthView = 'welcome' | 'login' | 'signup';

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [view, setView] = useState<AuthView>('welcome');

  if (!authed) {
    return (
      <AuthScreens
        view={view}
        onNavigate={setView}
        onAuthenticated={() => setAuthed(true)}
      />
    );
  }

  return (
    <AppStateProvider>
      <DashboardScreen />
    </AppStateProvider>
  );
}
