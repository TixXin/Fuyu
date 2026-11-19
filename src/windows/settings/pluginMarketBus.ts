type Listener = () => void;

const refreshRequests = new Set<Listener>();
const packageOffers = new Set<Listener>();
const refreshingWatchers = new Set<Listener>();
let refreshing = false;

const subscribe = (set: Set<Listener>, listener: Listener) => {
  set.add(listener);
  return () => {
    set.delete(listener);
  };
};

export function requestMarketRefresh() {
  for (const listener of [...refreshRequests]) listener();
}

export function onMarketRefreshRequest(listener: Listener) {
  return subscribe(refreshRequests, listener);
}

export function announceMarketPackage() {
  for (const listener of [...packageOffers]) listener();
}

export function onMarketPackage(listener: Listener) {
  return subscribe(packageOffers, listener);
}

export function setMarketRefreshing(next: boolean) {
  if (refreshing === next) return;
  refreshing = next;
  for (const listener of [...refreshingWatchers]) listener();
}

export function watchMarketRefreshing(listener: Listener) {
  return subscribe(refreshingWatchers, listener);
}

export function isMarketRefreshing() {
  return refreshing;
}
