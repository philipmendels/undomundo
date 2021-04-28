import { PayloadValueDelta, PayloadValueUndoRedo, Reducer } from '../src/types';

import { wrapReducer } from '../src';
import { makePayloadDeltaMap, makePayloadUndoRedoMap } from '../src/helpers';

export type State = {
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

// Need to use an object type literal. Interface does not seem to work due to index signature.
export type PBT = {
  updateCount: PayloadValueUndoRedo<number>;
  add: PayloadValueDelta<number>;
};

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

export const uReducer = wrapReducer<State, PBT>(reducer, {
  add: makePayloadDeltaMap(payload => -payload),
  updateCount: makePayloadUndoRedoMap(state => state.count),
});
