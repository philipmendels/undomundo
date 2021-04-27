import {
  PayloadByType,
  PayloadValueDelta,
  PayloadValueUndoRedo,
  Reducer,
} from '../src/types';

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

export interface PBT extends PayloadByType {
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

export const uReducer = wrapReducer<State, PBT>(reducer, {
  add: makePayloadDeltaMap(payload => -payload),
  updateCount: makePayloadUndoRedoMap(state => state.count),
});
