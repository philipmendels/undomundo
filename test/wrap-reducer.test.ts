import {
  PayloadByType,
  PayloadValueDelta,
  PayloadValueUndoRedo,
  Reducer,
  StateWithHistory,
} from '../src/types';

import { wrapReducer } from '../src';
import { makePayloadDeltaMap, makePayloadUndoRedoMap } from '../src/helpers';

type State = {
  count: number;
};

type Actions =
  | {
      type: 'add';
      payload: number;
    }
  | {
      type: 'updateCount';
      payload: number;
    };

interface PBT extends PayloadByType {
  updateCount: PayloadValueUndoRedo<number>;
  add: PayloadValueDelta<number>;
}

const reducer: Reducer<State, Actions> = (state, action) => {
  if (action.type === 'add') {
    return {
      ...state,
      count: state.count + action.payload,
    };
  }
  if (action.type === 'updateCount') {
    return {
      ...state,
      count: action.payload,
    };
  }
  return state;
};

const uReducer = wrapReducer<State, PBT>(reducer, {
  add: makePayloadDeltaMap(payload => -payload),
  updateCount: makePayloadUndoRedoMap(state => state.count),
});

describe('wrapReducer', () => {
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
    stateWithHist = uReducer(stateWithHist, { type: 'add', payload: 3 });
    expect(stateWithHist.state.count).toEqual(6);

    stateWithHist = uReducer(stateWithHist, {
      type: 'updateCount',
      payload: 4,
    });
    expect(stateWithHist.state.count).toEqual(4);

    stateWithHist = uReducer(stateWithHist, { type: 'undo' });
    expect(stateWithHist.state.count).toEqual(6);

    stateWithHist = uReducer(stateWithHist, { type: 'undo' });
    expect(stateWithHist.state.count).toEqual(3);

    stateWithHist = uReducer(stateWithHist, { type: 'redo' });
    expect(stateWithHist.state.count).toEqual(6);

    stateWithHist = uReducer(stateWithHist, { type: 'redo' });
    expect(stateWithHist.state.count).toEqual(4);
  });
});
