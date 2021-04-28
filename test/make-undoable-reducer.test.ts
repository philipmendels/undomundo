import { redo, undo } from '../src';
import { makeDeltaMap, makeUndoRedoMap } from '../src/helpers';
import { makeUndoableReducer } from '../src/make-undoable-reducer';
import { StateWithHistory } from '../src/types';
import { evolve, merge } from '../src/util';
import { State, PBT } from './shared';
import { add as add2 } from './util';

const { uReducer, actionCreators } = makeUndoableReducer<State, PBT>({
  add: makeDeltaMap(
    amount => evolve({ count: add2(amount) }),
    payload => -payload
  ),
  updateCount: makeUndoRedoMap(
    count => merge({ count }),
    state => state.count
  ),
});

const { add, updateCount } = actionCreators;

describe('makeUndoableReducer', () => {
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
  it('works', () => {
    stateWithHist = uReducer(stateWithHist, add(3));
    expect(stateWithHist.state.count).toEqual(6);

    stateWithHist = uReducer(stateWithHist, updateCount(4));
    expect(stateWithHist.state.count).toEqual(4);

    stateWithHist = uReducer(stateWithHist, undo());
    expect(stateWithHist.state.count).toEqual(6);

    stateWithHist = uReducer(stateWithHist, undo());
    expect(stateWithHist.state.count).toEqual(3);

    stateWithHist = uReducer(stateWithHist, redo());
    expect(stateWithHist.state.count).toEqual(6);

    stateWithHist = uReducer(stateWithHist, redo());
    expect(stateWithHist.state.count).toEqual(4);
  });
});
