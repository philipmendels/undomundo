import { wrapReducer } from './wrap-reducer';
import {
  PayloadConfigByType,
  UndoRedoConfigByType,
  UpdatersByType,
  PayloadOriginalByType,
  UActionCreatorsByType,
} from './types';
import { makeReducer, mapRecord } from './util';

export const makeCustomUndoableReducer = <S, PBT extends PayloadConfigByType>(
  configs: UndoRedoConfigByType<S, PBT>
) => {
  const { reducer, actionCreators } = makeReducer<
    S,
    PayloadOriginalByType<PBT>
  >(
    mapRecord(configs)<UpdatersByType<S, PayloadOriginalByType<PBT>>>(
      config => config.updateStateOnRedo
    )
  );
  return {
    uReducer: wrapReducer<S, PBT>(reducer, configs),
    actionCreators: mapRecord(actionCreators)<
      UActionCreatorsByType<PayloadOriginalByType<PBT>>
    >(ac => (payload, options) => ({
      ...ac(payload),
      ...(options && { meta: options }),
    })),
  };
};
