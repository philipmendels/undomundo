import { makeUndoableReducer } from './make-undoable-reducer';
import { redo, switchToBranch, timeTravel, undo } from './action-creators';
import {
  UState,
  PayloadHandlersByType,
  UReducerAction,
  PayloadConfigByType,
  ActionConfigByType,
  UOptions,
} from './types/main';
import { mapRecord } from './util';
import { CustomData, History } from './types/history';

export type OnChangeEvent<
  S,
  PBT extends PayloadConfigByType,
  CBD extends CustomData
> = {
  action: UReducerAction<PBT>;
  newUState: UState<S, PBT, CBD>;
  oldUState: UState<S, PBT, CBD>;
};

export type MakeUndoableStateProps<
  S,
  PBT extends PayloadConfigByType,
  CBD extends CustomData = {}
> = {
  initialUState: UState<S, PBT, CBD>;
  actionConfigs: ActionConfigByType<S, PBT>;
  options?: UOptions;
  onChange?: (event: OnChangeEvent<S, PBT, CBD>) => void;
  initializeCustomBranchData?: (history: History<PBT, CBD>) => CBD;
};

export const makeUndoableState = <
  S,
  PBT extends PayloadConfigByType,
  CBD extends CustomData = {}
>({
  initialUState,
  actionConfigs,
  options,
  onChange,
  initializeCustomBranchData,
}: MakeUndoableStateProps<S, PBT, CBD>) => {
  let uState = initialUState;

  const { uReducer, actionCreators } = makeUndoableReducer<S, PBT, CBD>(
    actionConfigs,
    options,
    initializeCustomBranchData
  );

  const withOnChange = (
    action: UReducerAction<PBT>,
    newUState: UState<S, PBT, CBD>
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
      PayloadHandlersByType<UState<S, PBT, CBD>, PBT>
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
