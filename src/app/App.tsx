import { BrowserRouter } from 'react-router-dom';
import { AppProviders } from './providers/AppProviders';
import { AuthModalController } from './providers/AuthModalController';
import { AppRouter } from './router/AppRouter';
import { ProgressSync } from './sync/ProgressSync';

/**
 * Composition only: what the app is made of, in the order it nests. Anything
 * that decides, fetches, maps or persists lives in one of the four pieces.
 *
 * `AuthModalController` is mounted exactly once, inside the router: two mounts
 * render two overlapping dialogs off the same store.
 */
const App = () => (
  <AppProviders>
    <BrowserRouter>
      <ProgressSync />
      <AppRouter />
      <AuthModalController />
    </BrowserRouter>
  </AppProviders>
);

export default App;
