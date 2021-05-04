import { pipe } from 'fp-ts/lib/function';
import { map } from 'fp-ts/lib/Record';
import { getDefaultUndoRedoConfigAbsolute } from './helpers';
import { makeCustomUndoableReducer } from './make-custom-undoable-reducer';
import {
  DefaultUndoRedoConfigByType,
  StringMap,
  ToPayloadConfigByType,
  UndoRedoConfigByType,
  ValueOf,
} from './types';

export const makeUndoableReducer = <S, M extends StringMap>(
  configs: DefaultUndoRedoConfigByType<S, M>
) => {
  type PBT = ToPayloadConfigByType<M>;
  return makeCustomUndoableReducer<S, PBT>(
    pipe(
      configs,
      map<any, any>((config: ValueOf<typeof configs>) =>
        getDefaultUndoRedoConfigAbsolute(
          config.updatePayload,
          config.updateState
        )
      )
    ) as UndoRedoConfigByType<S, PBT>
  );
};
