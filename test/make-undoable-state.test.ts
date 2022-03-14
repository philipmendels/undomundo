import { initUState } from '../src/helpers';
import { makeUndoableState, OnChangeEvent } from '../src/make-undoable-state';
import { AbsolutePayloadConfig, UActionUnion } from '../src/types/main';
import { merge } from '../src/util';

type State = {
  count: number;
};

type PBT = {
  updateCount: AbsolutePayloadConfig<number>;
};

type CallbackParams = OnChangeEvent<State, PBT, Record<string, unknown>>[];

let newUState = initUState<State, PBT>({
  count: 2,
});

const onChange = jest.fn<void, CallbackParams>();

const {
  undoables,
  undo,
  redo,
  getCurrentUState: getCurrentState,
} = makeUndoableState<State, PBT>({
  initialUState: newUState,
  actionConfigs: {
    updateCount: {
      updateState: count => merge({ count }),
      updateHistory: state => () => state.count,
    },
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
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.actions[0].type).toBe('updateCount');
    expect((lastCall.actions[0] as UActionUnion<PBT>).payload).toBe(4);
    expect(lastCall.newUState).toBe(newUState);
    expect(lastCall.oldUState).toBe(oldUState);
    // expect(onChange).toHaveBeenLastCalledWith<CallbackParams>({
    //   action: { type: 'updateCount', payload: 4 },
    //   newUState,
    //   oldUState,
    // });
  });

  it('undo works', () => {
    const oldUState = newUState;
    newUState = undo();
    expect(newUState.state.count).toBe(2);
    expectGetCurrentStateEquals();
    expect(onChange).toHaveBeenLastCalledWith<CallbackParams>({
      actions: [{ type: 'undo' }],
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
      actions: [{ type: 'redo' }],
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
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.actions[0].type).toBe('updateCount');
    expect((lastCall.actions[0] as UActionUnion<PBT>).payload).toBe(33);
    expect(
      (lastCall.actions[0] as UActionUnion<PBT>).undomundo.skipHistory
    ).toBe(true);
  });
});
