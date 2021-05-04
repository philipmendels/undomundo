import { negate } from 'fp-ts-std/Number';
import { redo, undo } from '../src/action-creators';
import { getDefaultUndoRedoConfigAbsolute } from '../src/helpers';
import { makeCustomUndoableReducer } from '../src/make-custom-undoable-reducer';
import { StateWithHistory } from '../src/types';
import { add, evolve, merge } from '../src/util';
import { State, PBT } from './shared';

const { uReducer, actionCreators } = makeCustomUndoableReducer<State, PBT>({
  addToCount: {
    undo: evolve({ payload: negate }),
    updateState: amount => evolve({ count: add(amount) }),
  },
  updateCount: getDefaultUndoRedoConfigAbsolute(
    state => _ => state.count,
    count => merge({ count })
  ),
});

const { addToCount, updateCount } = actionCreators;

describe('makeCustomUndoableReducer', () => {
  let stateWithHist: StateWithHistory<State, PBT> = {
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
    stateWithHist = uReducer(stateWithHist, addToCount(3));
    expect(stateWithHist.state.count).toEqual(6);

    stateWithHist = uReducer(stateWithHist, updateCount(4));
    expect(stateWithHist.state.count).toEqual(4);
  });

  it('undo works', () => {
    stateWithHist = uReducer(stateWithHist, undo());
    expect(stateWithHist.state.count).toEqual(6);

    stateWithHist = uReducer(stateWithHist, undo());
    expect(stateWithHist.state.count).toEqual(3);
  });

  it('redo works', () => {
    stateWithHist = uReducer(stateWithHist, redo());
    expect(stateWithHist.state.count).toEqual(6);

    stateWithHist = uReducer(stateWithHist, redo());
    expect(stateWithHist.state.count).toEqual(4);
  });
});
