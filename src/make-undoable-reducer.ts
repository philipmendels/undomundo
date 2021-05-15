import { wrapReducer } from './wrap-reducer';
import {
  PayloadConfigByType,
  ActionConfigByType,
  UpdatersByType,
  PayloadOriginalByType,
  UActionCreatorsByType,
} from './types';
import { makeReducer, mapRecord } from './util';

export const makeUndoableReducer = <S, PBT extends PayloadConfigByType>(
  actionConfigs: ActionConfigByType<S, PBT>
) => {
  const { reducer, actionCreators } = makeReducer<
    S,
    PayloadOriginalByType<PBT>
  >(
    mapRecord(actionConfigs)<UpdatersByType<S, PayloadOriginalByType<PBT>>>(
      config => config.updateStateOnRedo
    )
  );
  return {
    uReducer: wrapReducer<S, PBT>(reducer, actionConfigs),
    actionCreators: mapRecord(actionCreators)<
      UActionCreatorsByType<PayloadOriginalByType<PBT>>
    >(ac => (payload, options) => ({
      ...ac(payload),
      ...(options && { meta: options }),
    })),
  };
};
