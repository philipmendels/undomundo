import { makeDefaultActionConfig } from '../src/helpers';
import { makeUndoableState, OnChangeEvent } from '../src/make-undoable-state';
import { DefaultPayloadConfig, UState } from '../src/types';
import { merge } from '../src/util';
import { State } from './shared';

type PBT = {
  updateCount: DefaultPayloadConfig<number>;
};

type CallbackParams = OnChangeEvent<State, PBT>[];

let newUState: UState<State, PBT> = {
  effects: [],
  history: {
    stack: [],
    index: -1,
  },
  state: {
    count: 2,
  },
};

const onChange = jest.fn<void, CallbackParams>();

const {
  undoables,
  undo,
  redo,
  getCurrentUState: getCurrentState,
} = makeUndoableState<State, PBT>({
  initialUState: newUState,
  actionConfigs: {
    updateCount: makeDefaultActionConfig({
      updatePayload: state => _ => state.count,
      updateState: count => merge({ count }),
    }),
  },
  onChange,
});

const { updateCount } = undoables;

const expectGetCurrentStateEquals = () =>
  expect(newUState).toBe(getCurrentState());

describe('makeUndoableState', () => {
  it('update works', () => {
    const oldUState = newUState;
    newUState = updateCount(4);
    expect(newUState.state.count).toBe(4);
    expectGetCurrentStateEquals();
    expect(onChange).toHaveBeenLastCalledWith<CallbackParams>({
      action: { type: 'updateCount', payload: 4 },
      newUState,
      oldUState,
    });
  });

  it('undo works', () => {
    const oldUState = newUState;
    newUState = undo();
    expect(newUState.state.count).toBe(2);
    expectGetCurrentStateEquals();
    expect(onChange).toHaveBeenLastCalledWith<CallbackParams>({
      action: { type: 'undo' },
      newUState,
      oldUState,
    });
  });

  it('redo works', () => {
    const oldUState = newUState;
    newUState = redo();
    expect(newUState.state.count).toBe(4);
    expectGetCurrentStateEquals();
    expect(onChange).toHaveBeenLastCalledWith<CallbackParams>({
      action: { type: 'redo' },
      newUState,
      oldUState,
    });
  });

  it('skip history works', () => {
    const oldUState = newUState;
    const prevHist = oldUState.history;
    newUState = updateCount(33, { skipHistory: true });
    expect(newUState.state.count).toBe(33);
    expect(newUState.history).toBe(prevHist);
    expect(onChange).toHaveBeenLastCalledWith<CallbackParams>({
      action: { type: 'updateCount', payload: 33, meta: { skipHistory: true } },
      newUState,
      oldUState,
    });
  });
});
