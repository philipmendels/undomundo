// middle-ware: undo -> updateHistoryOnUndo ->
// - dispatch change history action and redispatch undo action (or combine the two)
// - dispatch result of makeActionForUndo

import { identity, pipe } from 'fp-ts/function';
import { v4 } from 'uuid';
import {
  addHistoryItem,
  getCurrentBranch,
  getCurrentIndex,
  storeLastGlobalIndex,
  updatePath,
} from './internal';
import { CustomData, History, HistoryItemUnion } from './types/history';
import {
  HistoryUpdate,
  PayloadConfigByType,
  Reducer,
  UOptions,
} from './types/main';
import { add1, evolve, merge, modifyArrayAt, subtract1 } from './util';

export type MakeHistoryReducerProps<
  PBT extends PayloadConfigByType,
  CBD extends CustomData = {}
> = {
  options: Required<UOptions>;
  initBranchData: (history: History<PBT, CBD>) => CBD;
};

export const makeHistoryReducer = <
  PBT extends PayloadConfigByType,
  CBD extends CustomData = {}
>({
  options,
  initBranchData,
}: MakeHistoryReducerProps<PBT, CBD>) => {
  const reducer: Reducer<History<PBT, CBD>, HistoryUpdate<PBT>> = (
    history,
    action
  ) => {
    const currentBranch = getCurrentBranch(history);
    const currentIndex = getCurrentIndex(history);

    if (action.type === 'UNDO_WITH_UPDATE') {
      return pipe(
        history,
        evolve({
          currentIndex: subtract1,
          branches:
            action.payload === undefined
              ? identity
              : evolve({
                  [currentBranch.id]: evolve({
                    stack: modifyArrayAt(
                      currentIndex,
                      merge({ payload: action.payload } as Partial<
                        HistoryItemUnion<PBT>
                      >)
                    ),
                  }),
                }),
        })
      );
    } else if (action.type === 'REDO_WITH_UPDATE') {
      return pipe(
        history,
        evolve({
          currentIndex: add1,
          branches:
            action.payload === undefined
              ? identity
              : evolve({
                  [currentBranch.id]: evolve({
                    stack: modifyArrayAt(
                      currentIndex + 1,
                      merge({ payload: action.payload } as Partial<
                        HistoryItemUnion<PBT>
                      >)
                    ),
                  }),
                }),
        })
      );
    } else if (action.type === 'ADD_TO_HISTORY') {
      return pipe(
        history,
        addHistoryItem(
          {
            ...action.payload,
            id: v4(),
            created: new Date(),
          },
          options,
          initBranchData
        )
      );
    } else if (action.type === 'STORE_INDEX') {
      return pipe(history, storeLastGlobalIndex());
    } else if (action.type === 'REBUILD_BRANCHES') {
      return pipe(history, updatePath(action.payload));
    }
    return history;
  };

  return reducer;
};
