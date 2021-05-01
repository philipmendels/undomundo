import { StateWithHistory } from '../src/types';
import { PBT, State, uReducer } from './shared';

describe('wrapReducer', () => {
  let stateWithHistory: StateWithHistory<State, PBT> = {
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
    stateWithHistory = uReducer(stateWithHistory, {
      type: 'addToCount',
      payload: 3,
    });
    expect(stateWithHistory.state.count).toEqual(6);

    stateWithHistory = uReducer(stateWithHistory, {
      type: 'updateCount',
      payload: 4,
    });

    expect(stateWithHistory.state.count).toEqual(4);
  });

  it('undo works', () => {
    stateWithHistory = uReducer(stateWithHistory, { type: 'undo' });
    expect(stateWithHistory.state.count).toEqual(6);

    stateWithHistory = uReducer(stateWithHistory, { type: 'undo' });
    expect(stateWithHistory.state.count).toEqual(3);
  });

  it('redo works', () => {
    stateWithHistory = uReducer(stateWithHistory, { type: 'redo' });
    expect(stateWithHistory.state.count).toEqual(6);

    stateWithHistory = uReducer(stateWithHistory, { type: 'redo' });
    expect(stateWithHistory.state.count).toEqual(4);
  });
});
