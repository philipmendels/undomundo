import { wrapReducer } from './wrap-reducer';
import {
  PayloadConfigByType,
  ActionConfigByType,
  UpdatersByType,
  UOptions,
  CustomActionConfig,
  OriginalPayloadByType,
} from './types/main';
import { makeReducer, mapRecord } from './util';
import { CustomData, InitBranchData } from './types/history';

export type MakeUndoableReducerReducerProps<
  S,
  PBT extends PayloadConfigByType,
  CBD extends CustomData = Record<string, unknown>
> = {
  actionConfigs: ActionConfigByType<S, PBT>;
  options?: UOptions<S>;
  initBranchData?: InitBranchData<PBT, CBD>;
};

export const makeUndoableReducer = <
  S,
  PBT extends PayloadConfigByType,
  CBD extends CustomData = Record<string, unknown>
>({
  actionConfigs,
  options,
  initBranchData,
}: MakeUndoableReducerReducerProps<S, PBT, CBD>) => {
  const { reducer } = makeReducer<S, PBT>(
    mapRecord(actionConfigs)<UpdatersByType<S, OriginalPayloadByType<PBT>>>(
      config => ({
        undo:
          (config as CustomActionConfig<S, PBT, any>).updateStateOnUndo ??
          config.updateState,
        redo: config.updateState,
      })
    )
  );

  return wrapReducer<S, PBT, CBD>({
    reducer,
    // pass the full actionConfig (not partial), because inside wrapReducer we still check if updateStateOnUndo is present
    actionConfigs,
    options,
    initBranchData,
  });
};
