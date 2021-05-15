import { getAbsoluteActionConfig } from './helpers';
import { makeCustomUndoableReducer } from './make-custom-undoable-reducer';
import {
  DefaultActionConfigByType,
  StringMap,
  ToPayloadConfigByType,
  UndoRedoConfigByType,
} from './types';
import { mapRecord } from './util';

export const makeUndoableReducer = <S, M extends StringMap>(
  configs: DefaultActionConfigByType<S, M>
) => {
  type PBT = ToPayloadConfigByType<M>;
  return makeCustomUndoableReducer<S, PBT>(
    mapRecord(configs)<UndoRedoConfigByType<S, PBT>>(
      config => getAbsoluteActionConfig(config) as any
    )
  );
};
