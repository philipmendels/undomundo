import { PayloadConfigUndoRedo, Reducer } from '../src/types';

import { wrapReducer } from '../src';
import { getDefaultUndoConfigAbsolute } from '../src/helpers';
import { add, evolve, merge } from '../src/util';
import { pipe } from 'fp-ts/function';
import { negate } from 'fp-ts-std/Number';

export type State = {
  count: number;
};

type Actions =
  | {
      type: 'addToCount';
      payload: number;
    }
  | {
      type: 'updateCount';
      payload: number;
    };

// Need to use an object type literal. Interface does not seem to work due to index signature.
export type PBT = {
  updateCount: PayloadConfigUndoRedo<number>;
  addToCount: {
    original: number;
  };
};

const reducer: Reducer<State, Actions> = (state, action) => {
  if (action.type === 'addToCount') {
    const { payload } = action;
    // just for testing if referentially equal state is ignored
    return payload === 0 ? state : pipe(state, evolve({ count: add(payload) }));
  }
  if (action.type === 'updateCount') {
    return pipe(state, merge({ count: action.payload }));
  }
  return state;
};

export const uReducer = wrapReducer<State, PBT>(reducer, {
  addToCount: {
    undo: evolve({ payload: negate }),
  },
  updateCount: getDefaultUndoConfigAbsolute(state => _ => state.count),
});
