import { useEffect, useState, type ComponentType } from 'react';
import { InitiativePanel } from './components/InitiativePanel';
import { ROUTES, Shell, type Route } from './components/Shell';
import { StoreProvider } from './state/store';
import { TourProvider } from './tour/Tour';
import { Approvals } from './views/Approvals';
import { Budget } from './views/Budget';
import { Overview } from './views/Overview';
import { Pipeline } from './views/Pipeline';
import { Register } from './views/Register';

/** Hash routing keeps the build deployable as static files on any host — no rewrites needed. */
function readRoute(): Route {
  const id = window.location.hash.replace(/^#\/?/, '');
  return (ROUTES.find((r) => r.id === id)?.id ?? 'overview') as Route;
}

const VIEWS: Record<Route, ComponentType> = {
  overview: Overview,
  initiatives: Register,
  approvals: Approvals,
  budget: Budget,
  pipeline: Pipeline,
};

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    const r = ROUTES.find((x) => x.id === route)!;
    document.title = `${r.label} — Field & Partner Planning · Portfolio demo`;
  }, [route]);

  const View = VIEWS[route];
  return (
    <StoreProvider>
      <TourProvider>
        <Shell route={route}>
          <View key={route} />
        </Shell>
        <InitiativePanel />
      </TourProvider>
    </StoreProvider>
  );
}
