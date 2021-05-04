import { makeUndoableReducer } from '.';
import { redo, undo } from './action-creators';
import {
  StringMap,
  DefaultUndoRedoConfigByType,
  ToPayloadConfigByType,
  StateWithHistory,
  PayloadHandlersByType,
  UActionUnion,
  UActions,
} from './types';
import { mapRecord } from './util';

type SWH<S, PBT extends StringMap> = StateWithHistory<
  S,
  ToPayloadConfigByType<PBT>
>;

export type OnChangeEvent<S, PBT extends StringMap> = {
  action: UActions | UActionUnion<PBT>;
  newState: SWH<S, PBT>;
  oldState: SWH<S, PBT>;
};

export const makeUndoableState = <S, PBT extends StringMap>(
  initialState: SWH<S, PBT>,
  configs: DefaultUndoRedoConfigByType<S, PBT>,
  onChange?: (event: OnChangeEvent<S, PBT>) => void
) => {
  let state = initialState;
  const { uReducer, actionCreators } = makeUndoableReducer<S, PBT>(configs);

  const withOnChange = (
    action: UActions | UActionUnion<PBT>,
    newState: SWH<S, PBT>
  ) => {
    const oldState = state;
    if (newState !== oldState) {
      state = newState;
      onChange?.({ action, newState, oldState });
    }
    return newState;
  };
  return {
    getCurrentState: () => state,

    undoables: mapRecord(actionCreators)<
      PayloadHandlersByType<SWH<S, PBT>, PBT>
    >(creator => payload => {
      const action = creator(payload);
      return withOnChange(action as any, uReducer(state, action));
    }),

    undo: () => {
      const action = undo();
      return withOnChange(action, uReducer(state, action));
    },
    redo: () => {
      const action = redo();
      return withOnChange(action, uReducer(state, action));
    },
  };
};
