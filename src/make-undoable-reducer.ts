import { pipe } from 'fp-ts/lib/function';
import { map } from 'fp-ts/lib/Record';
import { wrapReducer } from '.';
import {
  PayloadConfigByType,
  UndoRedoConfigByType,
  UpdatersByType,
  PayloadOriginalByType,
  ValueOf,
} from './types';
import { makeReducer } from './util';

export const makeUndoableReducer = <S, PBT extends PayloadConfigByType>(
  configs: UndoRedoConfigByType<S, PBT>
) => {
  const { reducer, actionCreators } = makeReducer<
    S,
    PayloadOriginalByType<PBT>
  >(
    pipe(
      configs,
      map<any, any>((config: ValueOf<typeof configs>) => config.updateState)
    ) as UpdatersByType<S, PayloadOriginalByType<PBT>>
  );
  return {
    uReducer: wrapReducer<S, PBT>(reducer, configs),
    actionCreators,
  };
};
