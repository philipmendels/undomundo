import { v4 } from 'uuid';
import { getCurrentBranch, getRedoAction, getUndoAction } from './internal';
import { CustomData, History, MaybeEmptyHistory } from './types/history';
import {
  ActionConfigByType,
  PartialActionConfigByType,
  PayloadConfigByType,
  SyncActionUnion,
  StateActionUnion,
  StateUpdate,
  UReducerOf,
  UState,
} from './types/main';

// This is only useful if you already have a reducer
// with the option keepStateUpdates: true and/or
// keepHistoryUpdates true
export const getUpdatesForAction = <
  S,
  PBT extends PayloadConfigByType,
  CBD extends CustomData = {}
>(
  uReducer: UReducerOf<S, PBT, CBD>
) => {
  return ([uState, action]: Parameters<UReducerOf<S, PBT, CBD>>) => {
    const stateWithEmptyOutput: UState<S, PBT, CBD> = {
      ...uState,
      stateUpdates: [],
      historyUpdates: [],
    };
    const { stateUpdates, historyUpdates } = uReducer(
      stateWithEmptyOutput,
      action
    );
    return { stateUpdates, historyUpdates };
  };
};

export const initUState = <
  S,
  PBT extends PayloadConfigByType,
  CD extends CustomData = {}
>(
  state: S,
  custom = {} as CD
): UState<S, PBT, CD> => ({
  historyUpdates: [],
  stateUpdates: [],
  history: initHistory(custom),
  state,
});

export const createEmptyHistory = <
  PBT extends PayloadConfigByType,
  CBD extends CustomData = {}
>(): MaybeEmptyHistory<PBT, CBD> => ({
  currentIndex: -1,
  branches: {},
  stats: {
    branchCounter: 0,
    actionCounter: 0,
  },
});

export const initHistory = <
  PBT extends PayloadConfigByType,
  CD extends CustomData = {}
>(
  custom = {} as CD
): History<PBT, CD> => {
  const initialBranchId = v4();
  const empty = createEmptyHistory();
  return {
    ...empty,
    branches: {
      [initialBranchId]: {
        id: initialBranchId,
        created: new Date().toISOString(),
        stack: [],
        custom,
      },
    },
    currentBranchId: initialBranchId,
    stats: {
      ...empty.stats,
      branchCounter: 1,
    },
  };
};

export const canRedo = <PBT extends PayloadConfigByType, CD extends CustomData>(
  history: History<PBT, CD>
) => history.currentIndex < getCurrentBranch(history).stack.length - 1;

export const canUndo = <PBT extends PayloadConfigByType, CD extends CustomData>(
  history: History<PBT, CD>
) => history.currentIndex >= 0;

export { getCurrentBranch };

type CastAction<
  S extends boolean,
  PBT extends PayloadConfigByType
> = S extends true ? SyncActionUnion<PBT> : StateActionUnion<PBT>;

export interface GetActionFromStateUpdateProps<S extends boolean> {
  isSynchronizing: S;
  invertAction?: boolean;
}

export const getAction = <S, PBT extends PayloadConfigByType>(
  actionConfigs: PartialActionConfigByType<S, PBT> | ActionConfigByType<S, PBT>
) => <S extends boolean>(props: GetActionFromStateUpdateProps<S>) => (
  update: StateUpdate<PBT>
): CastAction<S, PBT> => {
  const { isSynchronizing, invertAction = false } = props;
  let action: StateActionUnion<PBT>;
  if (
    (update.direction === 'undo' && !invertAction) ||
    (update.direction === 'redo' && invertAction)
  ) {
    action = getUndoAction(actionConfigs)(update.action);
  } else {
    action = getRedoAction(actionConfigs)(update.action);
  }

  if (isSynchronizing) {
    const syncAction: SyncActionUnion<PBT> = {
      ...action,
      undomundo: {
        ...action.undomundo,
        isSynchronizing: true,
      },
    };
    return syncAction as CastAction<S, PBT>;
  } else {
    return action as CastAction<S, PBT>;
  }
};
