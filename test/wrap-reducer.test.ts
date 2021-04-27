import { StateWithHistory } from '../src/types';
import { PBT, State, uReducer } from './shared';

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
