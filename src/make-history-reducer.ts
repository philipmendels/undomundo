// middle-ware: undo -> updateHistoryOnUndo ->
// - dispatch change history action and redispatch undo action (or combine the two)
// - dispatch result of makeActionForUndo

import { identity, pipe } from 'fp-ts/function';
import { getCurrentBranch, getCurrentIndex } from './internal';
import { CustomData, History, HistoryItemUnion } from './types/history';
import {
  HistoryUpdate,
  PartialActionConfigByType,
  PayloadConfigByType,
  Reducer,
  UOptions,
} from './types/main';
import { evolve, merge, modifyArrayAt, subtract1 } from './util';

// middle-ware: time-travel:
// - get the history and the state and both reducers
// - get all the output actions + for each action the direction (undo/redo) from the history reducer
// - iteratively for each action + direction call updateHistoryOnUndo/redo and call the state reducer to collect the new state, and dispatch the action and changeHistory action

// state: red 15 stack: green -> blue, 10 -> 20, orange -> green,
// undo: state: green, 15, stack: green -> red, 10 -> 20, orange -> green
// undo: state: green, 10, stack: green -> red, 10 -> 15, orange -> green
// undo: state: orange, 10, stack: green -> red, 10 -> 15, orange -> green

// state: 15, stack: +2, 6 -> 8
// undo: state: 13, stack: +2, 6 -> 8,
// undo: state: 13, stack: +2, 6 -> 13,

export type MakeHistoryReducer<
  PBT extends PayloadConfigByType,
  CBD extends CustomData = {}
> = {
  actionConfigs: PartialActionConfigByType<unknown, PBT>;
  options?: UOptions;
  initBranchData?: (history: History<PBT, CBD>) => CBD;
};

// export type HistoryReducerAction<PBT extends PayloadConfigByType> =
//   | HistoryUpdate<PBT>
//   | OriginalUActionUnion<PBT>;

export const makeHistoryReducer = <
  PBT extends PayloadConfigByType,
  CBD extends CustomData = {}
>() => {
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
    }
    return history;
  };

  return reducer;
};
