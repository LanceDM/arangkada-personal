import { BrowserRouter } from 'react-router-dom';
import { AppProviders } from './providers/AppProviders';
import { AuthModalController } from './providers/AuthModalController';
import { StudyGate } from './layout/StudyGate';
import { AppRouter } from './router/AppRouter';
import { ProgressSync } from './sync/ProgressSync';
import { StudyActivityLog } from './sync/StudyActivityLog';

/**
 * Composition only: what the app is made of, in the order it nests. Anything
 * that decides, fetches, maps or persists lives in one of the four pieces.
 *
 * `AuthModalController` is mounted exactly once, inside the router: two mounts
 * render two overlapping dialogs off the same store. `StudyGate` keeps a study
 * participant to their stage of the study's order.
 */
const App = () => (
  <AppProviders>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ProgressSync />
      <StudyActivityLog />
      <StudyGate>
        <AppRouter />
      </StudyGate>
      <AuthModalController />
    </BrowserRouter>
  </AppProviders>
);

export default App;
