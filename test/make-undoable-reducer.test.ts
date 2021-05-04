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
  let stateWithHist: StateWithHistory<State, ToPayloadConfigByType<PBT>> = {
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
    stateWithHist = uReducer(stateWithHist, updateCount(4));
    expect(stateWithHist.state.count).toEqual(4);
  });

  it('undo works', () => {
    stateWithHist = uReducer(stateWithHist, undo());
    expect(stateWithHist.state.count).toEqual(2);
  });

  it('redo works', () => {
    stateWithHist = uReducer(stateWithHist, redo());
    expect(stateWithHist.state.count).toEqual(4);
  });
});
