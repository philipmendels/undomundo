import { makeUndoableReducer } from '.';
import { redo, undo } from './action-creators';
import {
  UState,
  PayloadHandlersByType,
  UReducerAction,
  PayloadConfigByType,
  ActionConfigByType,
} from './types';
import { mapRecord } from './util';

export type OnChangeEvent<S, PBT extends PayloadConfigByType> = {
  action: UReducerAction<PBT>;
  newUState: UState<S, PBT>;
  oldUState: UState<S, PBT>;
};

export const makeUndoableState = <S, PBT extends PayloadConfigByType>({
  initialUState,
  actionConfigs,
  onChange,
}: {
  initialUState: UState<S, PBT>;
  actionConfigs: ActionConfigByType<S, PBT>;
  onChange?: (event: OnChangeEvent<S, PBT>) => void;
}) => {
  let uState = initialUState;
  const { uReducer, actionCreators } = makeUndoableReducer<S, PBT>(
    actionConfigs
  );

  const withOnChange = (
    action: UReducerAction<PBT>,
    newUState: UState<S, PBT>
  ) => {
    const oldUState = uState;
    if (newUState !== oldUState) {
      uState = newUState;
      onChange?.({ action, newUState, oldUState });
    }
    return newUState;
  };
  return {
    getCurrentUState: () => uState,

    undoables: mapRecord(actionCreators)<
      PayloadHandlersByType<UState<S, PBT>, PBT>
    >(creator => (payload, skipHistory) => {
      const action = creator(payload, skipHistory);
      return withOnChange(
        action as UReducerAction<PBT>,
        uReducer(uState, action)
      );
    }),

    undo: () => {
      const action = undo();
      return withOnChange(action, uReducer(uState, action));
    },
    redo: () => {
      const action = redo();
      return withOnChange(action, uReducer(uState, action));
    },
  };
};
