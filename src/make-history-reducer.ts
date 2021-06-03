import {
  PayloadConfigByType,
  PartialActionConfigByType,
  ActionConfigByType,
  HistoryOptions,
} from './types/main';
import { mapRecord } from './util';
import { identity } from 'fp-ts/function';
import { makeUndoableReducer } from './make-undoable-reducer';

export const makeHistoryReducer = <S, PBT extends PayloadConfigByType>(
  actionConfigs: PartialActionConfigByType<S, PBT>,
  options?: HistoryOptions
) => {
  return makeUndoableReducer(
    mapRecord(actionConfigs)<ActionConfigByType<S, PBT>>(config => ({
      ...config,
      // We could run effects from within the two functions below,
      // but that would make the reducer impure.
      updateStateOnRedo: () => identity,
      updateStateOnUndo: () => identity,
    })),
    {
      ...options,
      checkStateEquals: false,
    }
  );
};
