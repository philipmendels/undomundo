import { wrapReducer } from './wrap-reducer';
import {
  PayloadConfigByType,
  ActionConfigByType,
  UpdatersByType,
  PayloadOriginalByType,
  UActionCreatorsByType,
  UOptions,
  UReducerOf,
} from './types/main';
import { makeReducer, mapRecord } from './util';
import { CustomData, History } from './types/history';

export const getOutput = <S, PBT extends PayloadConfigByType>(
  actionConfigs: ActionConfigByType<S, PBT>
) => {
  const { uReducer } = makeUndoableReducer(actionConfigs, {
    storeOutput: true,
  });
  return (...args: Parameters<UReducerOf<S, PBT>>) => {
    const { output } = uReducer(...args);
    return output;
  };
};

export const makeUndoableReducer = <
  S,
  PBT extends PayloadConfigByType,
  CBD extends CustomData = {}
>(
  actionConfigs: ActionConfigByType<S, PBT>,
  options?: UOptions,
  initializeCustomBranchData?: (history: History<PBT, CBD>) => CBD
) => {
  const { reducer, actionCreators } = makeReducer<
    S,
    PayloadOriginalByType<PBT>
  >(
    mapRecord(actionConfigs)<UpdatersByType<S, PayloadOriginalByType<PBT>>>(
      config => ({
        undo: config.updateStateOnUndo,
        redo: config.updateStateOnRedo,
      })
    )
  );
  return {
    uReducer: wrapReducer<S, PBT, CBD>(
      reducer,
      actionConfigs,
      options,
      initializeCustomBranchData
    ),
    actionCreators: mapRecord(actionCreators)<
      UActionCreatorsByType<PayloadOriginalByType<PBT>>
    >(ac => (payload, options) => ({
      ...ac(payload),
      ...(options && { meta: options }),
    })),
  };
};
