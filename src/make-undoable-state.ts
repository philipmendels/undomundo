import { makeUndoableReducer } from '.';
import { redo, undo } from './action-creators';
import {
  StringMap,
  DefaultUndoRedoConfigByType,
  ToPayloadConfigByType,
  StateWithHistory,
  PayloadHandlersByType,
} from './types';
import { mapRecord } from './util';

export const makeUndoableState = <S, PBT extends StringMap>(
  initialState: StateWithHistory<S, ToPayloadConfigByType<PBT>>,
  configs: DefaultUndoRedoConfigByType<S, PBT>
) => {
  let state: typeof initialState;
  const { uReducer, actionCreators } = makeUndoableReducer<S, PBT>(configs);
  return {
    getCurrentState: () => state,
    undoables: mapRecord(actionCreators)<
      PayloadHandlersByType<
        StateWithHistory<S, ToPayloadConfigByType<PBT>>,
        PBT
      >
    >(creator => payload => {
      state = uReducer(state, creator(payload));
      return state;
    }),
    undo: () => {
      state = uReducer(state, undo());
      return state;
    },
    redo: () => {
      state = uReducer(state, redo());
      return state;
    },
    // TODO: onChange?
  };
};
