import { makeUndoableState, OnChangeEvent } from '../src/make-undoable-state';
import { StateWithHistory, ToPayloadConfigByType } from '../src/types';
import { merge } from '../src/util';
import { State } from './shared';

type PBT = {
  updateCount: number;
};

type CallbackParams = OnChangeEvent<State, PBT>[];

let newState: StateWithHistory<State, ToPayloadConfigByType<PBT>> = {
  effects: [],
  history: {
    stack: [],
    index: -1,
  },
  state: {
    count: 2,
  },
};

const callback = jest.fn<void, CallbackParams>();

const { undoables, undo, redo, getCurrentState } = makeUndoableState<
  State,
  PBT
>(
  newState,
  {
    updateCount: {
      updatePayload: state => _ => state.count,
      updateState: count => merge({ count }),
    },
  },
  callback
);

const { updateCount } = undoables;

const expectGetCurrentStateEquals = () =>
  expect(newState).toBe(getCurrentState());

describe('makeUndoableState', () => {
  it('update works', () => {
    const oldState = newState;
    newState = updateCount(4);
    expect(newState.state.count).toBe(4);
    expectGetCurrentStateEquals();
    expect(callback).toHaveBeenLastCalledWith<CallbackParams>({
      action: { type: 'updateCount', payload: 4 },
      newState,
      oldState,
    });
  });

  it('undo works', () => {
    const oldState = newState;
    newState = undo();
    expect(newState.state.count).toBe(2);
    expectGetCurrentStateEquals();
    expect(callback).toHaveBeenLastCalledWith<CallbackParams>({
      action: { type: 'undo' },
      newState,
      oldState,
    });
  });

  it('redo works', () => {
    const oldState = newState;
    newState = redo();
    expect(newState.state.count).toBe(4);
    expectGetCurrentStateEquals();
    expect(callback).toHaveBeenLastCalledWith<CallbackParams>({
      action: { type: 'redo' },
      newState,
      oldState,
    });
  });

  it('skip history works', () => {
    const oldState = newState;
    const prevHist = oldState.history;
    newState = updateCount(33, { skipHistory: true });
    expect(newState.state.count).toBe(33);
    expect(newState.history).toBe(prevHist);
    expect(callback).toHaveBeenLastCalledWith<CallbackParams>({
      action: { type: 'updateCount', payload: 33, meta: { skipHistory: true } },
      newState,
      oldState,
    });
  });
});
