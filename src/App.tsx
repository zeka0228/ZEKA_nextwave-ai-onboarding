import { AppStateProvider } from './app/AppStateProvider';
import { DashboardScreen } from './screens/DashboardScreen';

export default function App() {
  return (
    <AppStateProvider>
      <DashboardScreen />
    </AppStateProvider>
  );
}
