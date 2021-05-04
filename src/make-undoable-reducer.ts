import { getDefaultUndoRedoConfigAbsolute } from './helpers';
import { makeCustomUndoableReducer } from './make-custom-undoable-reducer';
import {
  DefaultUndoRedoConfigByType,
  StringMap,
  ToPayloadConfigByType,
  UndoRedoConfigByType,
} from './types';
import { mapRecord } from './util';

export const makeUndoableReducer = <S, M extends StringMap>(
  configs: DefaultUndoRedoConfigByType<S, M>
) => {
  type PBT = ToPayloadConfigByType<M>;
  return makeCustomUndoableReducer<S, PBT>(
    mapRecord(configs)<UndoRedoConfigByType<S, PBT>>(
      config =>
        getDefaultUndoRedoConfigAbsolute(
          config.updatePayload,
          config.updateState
        ) as any
    )
  );
};
