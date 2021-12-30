import { makeUndoableReducer } from './make-undoable-reducer';
import {
  clearHistoryUpdates,
  clearStateUpdates,
  redo,
  switchToBranch,
  timeTravel,
  undo,
} from './action-creators';
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
import { canRedo, canUndo, getAction, getCurrentBranch } from './helpers';

export type OnChangeEvent<
  S,
  PBT extends PayloadConfigByType,
  CBD extends CustomData
> = {
  actions: UReducerAction<PBT>[];
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
  options?: UOptions<S>;
  onChange?: (event: OnChangeEvent<S, PBT, CBD>) => void;
  initBranchData?: (history: History<PBT, CBD>) => CBD;
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
  initBranchData,
}: MakeUndoableStateProps<S, PBT, CBD>) => {
  let uState = initialUState;

  const { uReducer, actionCreators } = makeUndoableReducer<S, PBT, CBD>({
    actionConfigs,
    options,
    initBranchData,
  });

  const withOnChange = (
    actions: UReducerAction<PBT>[],
    newUState: UState<S, PBT, CBD>
  ) => {
    const oldUState = uState;
    if (newUState !== oldUState) {
      uState = newUState;
      onChange?.({ actions, newUState, oldUState });
    }
    return newUState;
  };

  return {
    getCurrentUState: () => uState,

    undoables: mapRecord(actionCreators)<
      PayloadHandlersByType<UState<S, PBT, CBD>, PBT>
      //@ts-ignore
    >(creator => (payload, options) => {
      //@ts-ignore
      const action = creator(payload, options);
      return withOnChange(
        [action] as UReducerAction<PBT>[],
        uReducer(uState, action)
      );
    }),
    getCurrentBranch: () => getCurrentBranch(uState.history),
    canUndo: () => canUndo(uState.history),
    canRedo: () => canRedo(uState.history),
    undo: () => {
      const action = undo();
      return withOnChange([action], uReducer(uState, action));
    },
    redo: () => {
      const action = redo();
      return withOnChange([action], uReducer(uState, action));
    },
    timeTravel: (...params: Parameters<typeof timeTravel>) => {
      const action = timeTravel(...params);
      return withOnChange([action], uReducer(uState, action));
    },
    switchToBranch: (...params: Parameters<typeof switchToBranch>) => {
      const action = switchToBranch(...params);
      return withOnChange([action], uReducer(uState, action));
    },
    clearStateUpdates: (...params: Parameters<typeof clearStateUpdates>) => {
      const action = clearStateUpdates(...params);
      return withOnChange([action], uReducer(uState, action));
    },
    clearHistoryUpdates: (
      ...params: Parameters<typeof clearHistoryUpdates>
    ) => {
      const action = clearHistoryUpdates(...params);
      return withOnChange([action], uReducer(uState, action));
    },
    handleActions: (actions: UReducerAction<PBT>[]) => {
      return withOnChange(actions, actions.reduce(uReducer, uState));
    },
    getActionFromStateUpdate: getAction(actionConfigs),
  };
};
