import { negate } from 'fp-ts-std/Number';
import { redo, undo } from '../src/action-creators';
import {
  makeDefaultActionConfig,
  makeRelativeActionConfig,
} from '../src/helpers';
import { createInitialHistory } from '../src/internal';
import { makeUndoableReducer } from '../src/make-undoable-reducer';
import {
  DefaultPayloadConfig,
  RelativePayloadConfig,
  UState,
} from '../src/types/main';
import { add, evolve, merge, subtract } from '../src/util';

type State = {
  count: number;
};

type PBT = {
  updateCount: DefaultPayloadConfig<number>;
  addToCount: RelativePayloadConfig<number>;
  addToCount_alt: RelativePayloadConfig<number>;
};

const { uReducer, actionCreators } = makeUndoableReducer<State, PBT>({
  addToCount: makeRelativeActionConfig({
    // payload conversion for undo:
    makeActionForUndo: evolve({ payload: negate }),
    updateState: amount => evolve({ count: add(amount) }),
  }),
  addToCount_alt: makeRelativeActionConfig({
    // separate updater for undo
    updateStateOnUndo: amount => evolve({ count: subtract(amount) }),
    updateState: amount => evolve({ count: add(amount) }),
  }),
  updateCount: makeDefaultActionConfig({
    updatePayload: state => _ => state.count,
    updateState: count => merge({ count }),
  }),
});

const { addToCount, addToCount_alt, updateCount } = actionCreators;

describe('makeUndoableReducer', () => {
  let uState: UState<State, PBT> = {
    output: [],
    history: createInitialHistory(),
    state: {
      count: 3,
    },
  };

  it('update works', () => {
    uState = uReducer(uState, addToCount(3));
    expect(uState.state.count).toBe(6);

    uState = uReducer(uState, addToCount_alt(2));
    expect(uState.state.count).toBe(8);

    uState = uReducer(uState, updateCount(4));
    expect(uState.state.count).toBe(4);
  });

  it('undo works', () => {
    uState = uReducer(uState, undo());
    expect(uState.state.count).toBe(8);

    uState = uReducer(uState, undo());
    expect(uState.state.count).toBe(6);

    uState = uReducer(uState, undo());
    expect(uState.state.count).toBe(3);
  });

  it('redo works', () => {
    uState = uReducer(uState, redo());
    expect(uState.state.count).toBe(6);

    uState = uReducer(uState, redo());
    expect(uState.state.count).toBe(8);

    uState = uReducer(uState, redo());
    expect(uState.state.count).toBe(4);
  });

  it('skip history works', () => {
    const prevUState = uState;
    uState = uReducer(uState, addToCount(9, { skipHistory: true }));
    expect(uState.state.count).toBe(13);

    uState = uReducer(uState, addToCount_alt(5, { skipHistory: true }));
    expect(uState.state.count).toBe(18);

    uState = uReducer(uState, updateCount(33, { skipHistory: true }));
    expect(uState.state.count).toBe(33);
    expect(uState.history).toBe(prevUState.history);
  });
});
