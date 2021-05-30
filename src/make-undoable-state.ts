import { makeUndoableReducer } from './make-undoable-reducer';
import { redo, switchToBranch, timeTravel, undo } from './action-creators';
import {
  UState,
  PayloadHandlersByType,
  UReducerAction,
  PayloadConfigByType,
  ActionConfigByType,
  UOptions,
  Endomorphism,
} from './types/main';
import { mapRecord } from './util';

export type OnChangeEvent<S, PBT extends PayloadConfigByType> = {
  action: UReducerAction<PBT>;
  newUState: UState<S, PBT>;
  oldUState: UState<S, PBT>;
};

export type MakeUndoableStateProps<S, PBT extends PayloadConfigByType> = {
  initialUState: UState<S, PBT>;
  actionConfigs: ActionConfigByType<S, PBT>;
  options?: UOptions;
  onChange?: (event: OnChangeEvent<S, PBT>) => void;
};

export const makeUndoableState = <S, PBT extends PayloadConfigByType>({
  initialUState,
  actionConfigs,
  options,
  onChange,
}: MakeUndoableStateProps<S, PBT>) => {
  let uState = initialUState;

  const { uReducer, actionCreators } = makeUndoableReducer<S, PBT>(
    actionConfigs,
    options
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
    setUState: (updater: Endomorphism<UState<S, PBT>>) => {
      uState = updater(uState);
    },
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
    timeTravel: (...params: Parameters<typeof timeTravel>) => {
      const action = timeTravel(...params);
      return withOnChange(action, uReducer(uState, action));
    },
    switchToBranch: (...params: Parameters<typeof switchToBranch>) => {
      const action = switchToBranch(...params);
      return withOnChange(action, uReducer(uState, action));
    },
  };
};
