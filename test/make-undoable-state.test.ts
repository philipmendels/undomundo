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
  expect(newState).toEqual(getCurrentState());

describe('makeUndoableState', () => {
  it('update works', () => {
    const oldState = newState;
    newState = updateCount(4);
    expect(newState.state.count).toEqual(4);
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
    expect(newState.state.count).toEqual(2);
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
    expect(newState.state.count).toEqual(4);
    expectGetCurrentStateEquals();
    expect(callback).toHaveBeenLastCalledWith<CallbackParams>({
      action: { type: 'redo' },
      newState,
      oldState,
    });
  });
});
