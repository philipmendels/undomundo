import { pipe } from 'fp-ts/lib/function';
import { map } from 'fp-ts/lib/Record';
import { wrapReducer } from '.';
import {
  PayloadByType,
  UndoRedoMapByType,
  UpdatersByType,
  ValueByType,
} from './types';
import { makeReducer } from './util';

export const makeUndoableReducer = <S, PBT extends PayloadByType>(
  payloadMaps: UndoRedoMapByType<S, PBT>
) => {
  const { reducer, actionCreators } = makeReducer<S, ValueByType<PBT>>(
    pipe(
      payloadMaps,
      map(v => v.setValue)
    ) as UpdatersByType<S, ValueByType<PBT>>
  );
  return {
    uReducer: wrapReducer<S, PBT>(reducer, payloadMaps),
    actionCreators,
  };
};
