import type {PlacesProvider, ResolvedPlace} from '../maps/types';

/** A `PlacesProvider` over a fixed list, recording what the fields asked for. */
export function createFakePlaces(places: readonly ResolvedPlace[]) {
  const log = {sessions: [] as object[], suggestSessions: [] as object[], resolveSessions: [] as object[]};

  const provider: PlacesProvider = {
    newSession() {
      const session = {n: log.sessions.length + 1};
      log.sessions.push(session);
      return session;
    },
    async suggest(query, {session}) {
      log.suggestSessions.push(session);
      return places
        .filter((place) => place.label.toLowerCase().includes(query.toLowerCase()))
        .map((place) => ({id: place.id, label: place.label}));
    },
    async resolve(id, {session}) {
      log.resolveSessions.push(session);
      const place = places.find((candidate) => candidate.id === id);
      if (!place) throw new Error(`no place ${id}`);
      return place;
    },
  };
  return {provider, log};
}

export const BERLIN: ResolvedPlace = {
  id: 'berlin',
  label: 'Unter den Linden 1, Berlin',
  lat: 52.517,
  lng: 13.389,
  address: {
    line1: 'Unter den Linden 1',
    line2: '',
    city: 'Berlin',
    region: 'Berlin',
    postalCode: '10117',
    country: 'DE',
  },
};

export const PUNE: ResolvedPlace = {
  id: 'pune',
  label: 'FC Road, Pune',
  lat: 18.52,
  lng: 73.84,
  address: {line1: 'FC Road', line2: '', city: 'Pune', region: 'Maharashtra', postalCode: '411004', country: 'IN'},
};
