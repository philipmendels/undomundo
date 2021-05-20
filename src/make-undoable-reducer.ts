import { wrapReducer } from './wrap-reducer';
import {
  PayloadConfigByType,
  ActionConfigByType,
  UpdatersByType,
  PayloadOriginalByType,
  UActionCreatorsByType,
  UOptions,
} from './types/main';
import { makeReducer, mapRecord } from './util';

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
