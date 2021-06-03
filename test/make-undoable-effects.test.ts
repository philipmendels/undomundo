import { makeDefaultEffectConfig } from '../src/helpers';
import { createInitialHistory } from '../src/internal';
import { DefaultPayloadConfig } from '../src/types/main';

import { makeUndoableEffects } from '../src/make-undoable-effects';

type PBT = {
  updateCount: DefaultPayloadConfig<number>;
};

type State = {
  count: number;
};

let state: State = {
  count: 2,
};

let history = createInitialHistory<PBT>();

const { undoables, undo, redo, timeTravel } = makeUndoableEffects<State, PBT>({
  getState: () => state,
  getHistory: () => history,
  effectConfigs: {
    updateCount: makeDefaultEffectConfig({
      effect: count => {
        console.log('effect', count);
        state = { ...state, count };
      },
      updatePayload: state => p => {
        console.log('up', p, state.count);
        return state.count;
      },
    }),
  },
  onChange: ({ newHist }) => {
    history = newHist.history;
  },
});

const { updateCount } = undoables;

describe('makeUndoableEffects', () => {
  it('works', () => {
    updateCount(7);
    expect(state.count).toBe(7);
    undo();
    expect(state.count).toBe(2);
    redo();
    expect(state.count).toBe(7);
    updateCount(11);
    updateCount(13);
    updateCount(17);
    state.count = 999;
    console.log('-----');
    timeTravel(-1);
    expect(state.count).toBe(2);
    timeTravel(2);
    expect(state.count).toBe(13);
  });
});
