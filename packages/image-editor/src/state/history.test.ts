import {describe, expect, it} from 'vitest';

import {HISTORY_LIMIT, createHistory, historyReducer, type History, type HistoryAction} from './history.js';

type Action = {type: 'add'; value: number} | {type: 'noop'};
const reduce = historyReducer<number, Action>((state, action) =>
  action.type === 'add' ? state + action.value : state,
);

function run(history: History<number>, ...actions: HistoryAction<number, Action>[]) {
  return actions.reduce(reduce, history);
}

const add = (value: number, transient = false): HistoryAction<number, Action> => ({
  type: 'apply',
  action: {type: 'add', value},
  transient,
});

describe('history', () => {
  it('records each action and undoes and redoes it', () => {
    const history = run(createHistory(0), add(1), add(2));
    expect(history.present).toBe(3);
    expect(run(history, {type: 'undo'}).present).toBe(1);
    expect(run(history, {type: 'undo'}, {type: 'undo'}, {type: 'undo'}).present).toBe(0);
    expect(run(history, {type: 'undo'}, {type: 'redo'}).present).toBe(3);
    expect(run(history, {type: 'redo'})).toEqual(history);
  });

  it('drops the redo branch on a new action', () => {
    const history = run(createHistory(0), add(1), add(2), {type: 'undo'}, add(5));
    expect(history.future).toEqual([]);
    expect(history.past).toEqual([0, 1]);
  });

  it('records nothing for an action that changes nothing', () => {
    const history = createHistory(0);
    expect(run(history, {type: 'apply', action: {type: 'noop'}})).toBe(history);
  });

  it('groups a gesture into one entry on commit', () => {
    const history = run(createHistory(0), add(1, true), add(1, true), add(1, true), {type: 'commit'});
    expect(history.present).toBe(3);
    expect(history.past).toEqual([0]);
    expect(history.pending).toBeNull();
  });

  it('commits a pending gesture before a normal action, an undo or a redo', () => {
    expect(run(createHistory(0), add(1, true), add(2)).past).toEqual([0]);
    const undone = run(createHistory(0), add(1, true), add(1, true), {type: 'undo'});
    expect(undone.present).toBe(0);
    expect(undone.future).toEqual([2]);
    expect(run(createHistory(0), add(1), {type: 'undo'}, add(1, true), {type: 'redo'}).present).toBe(1);
  });

  it('ignores a commit with nothing pending', () => {
    const history = createHistory(0);
    expect(run(history, {type: 'commit'})).toBe(history);
  });

  it(`keeps at most ${HISTORY_LIMIT} entries`, () => {
    const actions = Array.from({length: HISTORY_LIMIT + 10}, () => add(1));
    const history = run(createHistory(0), ...actions);
    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.past[0]).toBe(10);
  });

  it('starts over on init', () => {
    expect(run(createHistory(0), add(1), {type: 'init', state: 7})).toEqual(createHistory(7));
  });
});
