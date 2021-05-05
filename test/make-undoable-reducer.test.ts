import { redo, undo } from '../src/action-creators';
import { makeUndoableReducer } from '../src/make-undoable-reducer';
import { StateWithHistory, ToPayloadConfigByType } from '../src/types';
import { merge } from '../src/util';
import { State } from './shared';

type PBT = {
  updateCount: number;
};

const { uReducer, actionCreators } = makeUndoableReducer<State, PBT>({
  updateCount: {
    updatePayload: state => _ => state.count,
    updateState: count => merge({ count }),
  },
});

const { updateCount } = actionCreators;

describe('makeUndoableReducer', () => {
  let uState: StateWithHistory<State, ToPayloadConfigByType<PBT>> = {
    effects: [],
    history: {
      stack: [],
      index: -1,
    },
    state: {
      count: 2,
    },
  };
  it('update works', () => {
    uState = uReducer(uState, updateCount(4));
    expect(uState.state.count).toBe(4);
  });

  it('undo works', () => {
    uState = uReducer(uState, undo());
    expect(uState.state.count).toBe(2);
  });

  it('redo works', () => {
    uState = uReducer(uState, redo());
    expect(uState.state.count).toBe(4);
  });

  it('skip history works', () => {
    const prevUState = uState;
    uState = uReducer(uState, updateCount(33, true));
    expect(uState.state.count).toBe(33);
    expect(uState.history).toBe(prevUState.history);
  });
});
