import { negate } from 'fp-ts-std/Number';
import { redo, undo } from '../src/action-creators';
import {
  makeAbsoluteUndoRedoConfig,
  makeRelativeUndoRedoConfig,
} from '../src/helpers';
import { makeCustomUndoableReducer } from '../src/make-custom-undoable-reducer';
import { StateWithHistory } from '../src/types';
import { add, evolve, merge } from '../src/util';
import { State, PBT } from './shared';

const { uReducer, actionCreators } = makeCustomUndoableReducer<State, PBT>({
  addToCount: makeRelativeUndoRedoConfig({
    getActionForUndo: evolve({ payload: negate }),
    updateState: amount => evolve({ count: add(amount) }),
  }),
  updateCount: makeAbsoluteUndoRedoConfig({
    updatePayload: state => _ => state.count,
    updateState: count => merge({ count }),
  }),
});

const { addToCount, updateCount } = actionCreators;

describe('makeCustomUndoableReducer', () => {
  let uState: StateWithHistory<State, PBT> = {
    effects: [],
    history: {
      stack: [],
      index: -1,
    },
    state: {
      count: 3,
    },
  };

  it('update works', () => {
    uState = uReducer(uState, addToCount(3));
    expect(uState.state.count).toBe(6);

    uState = uReducer(uState, updateCount(4));
    expect(uState.state.count).toBe(4);
  });

  it('undo works', () => {
    uState = uReducer(uState, undo());
    expect(uState.state.count).toBe(6);

    uState = uReducer(uState, undo());
    expect(uState.state.count).toBe(3);
  });

  it('redo works', () => {
    uState = uReducer(uState, redo());
    expect(uState.state.count).toBe(6);

    uState = uReducer(uState, redo());
    expect(uState.state.count).toBe(4);
  });

  it('skip history works', () => {
    const prevUState = uState;
    uState = uReducer(uState, addToCount(9, { skipHistory: true }));
    expect(uState.state.count).toBe(13);

    uState = uReducer(uState, updateCount(33, { skipHistory: true }));
    expect(uState.state.count).toBe(33);
    expect(uState.history).toBe(prevUState.history);
  });
});
