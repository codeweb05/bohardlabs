/**
 * An undo stack that groups a continuous gesture (a drag, a held slider, a wheel burst)
 * into one entry. A transient `apply` changes the present but remembers the state from
 * before the gesture in `pending`; `commit` pushes that once.
 */
export interface History<S> {
  past: S[];
  present: S;
  future: S[];
  pending: S | null;
}

export type HistoryAction<S, A> =
  | {type: 'apply'; action: A; transient?: boolean}
  | {type: 'commit'}
  | {type: 'undo'}
  | {type: 'redo'}
  | {type: 'init'; state: S};

export const HISTORY_LIMIT = 50;

export function createHistory<S>(present: S): History<S> {
  return {past: [], present, future: [], pending: null};
}

function push<S>(past: S[], state: S): S[] {
  return [...past, state].slice(-HISTORY_LIMIT);
}

function commit<S>(history: History<S>): History<S> {
  if (history.pending === null) return history;
  if (history.pending === history.present) return {...history, pending: null};
  return {past: push(history.past, history.pending), present: history.present, future: [], pending: null};
}

export function historyReducer<S, A>(reducer: (state: S, action: A) => S) {
  return (history: History<S>, action: HistoryAction<S, A>): History<S> => {
    switch (action.type) {
      case 'apply': {
        const present = reducer(history.present, action.action);
        if (present === history.present) return history;
        if (action.transient) return {...history, present, pending: history.pending ?? history.present};
        const before = history.pending ?? history.present;
        return {past: push(history.past, before), present, future: [], pending: null};
      }
      case 'commit':
        return commit(history);
      case 'undo': {
        const settled = commit(history);
        const previous = settled.past.at(-1);
        if (previous === undefined) return settled;
        return {
          past: settled.past.slice(0, -1),
          present: previous,
          future: [settled.present, ...settled.future],
          pending: null,
        };
      }
      case 'redo': {
        const settled = commit(history);
        const [following, ...rest] = settled.future;
        if (following === undefined) return settled;
        return {past: push(settled.past, settled.present), present: following, future: rest, pending: null};
      }
      case 'init':
        return createHistory(action.state);
    }
  };
}
