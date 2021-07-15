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

export const makeUndoableReducer = <S, PBT extends PayloadConfigByType>(
  actionConfigs: ActionConfigByType<S, PBT>,
  options?: UOptions
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
    uReducer: wrapReducer<S, PBT>(reducer, actionConfigs, options),
    actionCreators: mapRecord(actionCreators)<
      UActionCreatorsByType<PayloadOriginalByType<PBT>>
    >(ac => (payload, options) => ({
      ...ac(payload),
      ...(options && { meta: options }),
    })),
  };
};
