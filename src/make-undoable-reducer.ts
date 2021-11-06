import { wrapReducer } from './wrap-reducer';
import {
  PayloadConfigByType,
  ActionConfigByType,
  UpdatersByType,
  OriginalPayloadByType,
  UOptions,
} from './types/main';
import { makeReducer, mapRecord } from './util';
import { CustomData, History } from './types/history';

export type MakeUndoableReducerReducerProps<
  S,
  PBT extends PayloadConfigByType,
  CBD extends CustomData = {}
> = {
  actionConfigs: ActionConfigByType<S, PBT>;
  options?: UOptions;
  initBranchData?: (history: History<PBT, CBD>) => CBD;
};

export const makeUndoableReducer = <
  S,
  PBT extends PayloadConfigByType,
  CBD extends CustomData = {}
>({
  actionConfigs,
  options,
  initBranchData,
}: MakeUndoableReducerReducerProps<S, PBT, CBD>) => {
  const { reducer } = makeReducer<S, OriginalPayloadByType<PBT>>(
    mapRecord(actionConfigs)<UpdatersByType<S, OriginalPayloadByType<PBT>>>(
      config => ({
        undo: config.updateStateOnUndo ?? config.updateState,
        redo: config.updateState,
      })
    )
  );
  return wrapReducer<S, PBT, CBD>({
    reducer,
    actionConfigs,
    options,
    initBranchData,
  });
};
