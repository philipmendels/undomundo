import { append } from 'fp-ts/Array';
import { identity, pipe } from 'fp-ts/function';
import { v4 } from 'uuid';
import {
  addHistoryItem,
  getCurrentBranch,
  getCurrentIndex,
  redo,
  undo,
} from './internal';
import {
  PayloadConfigByType,
  PartialActionConfigByType,
  OriginalUActionUnion,
  UReducerOf,
  ReducerOf,
  OriginalActionUnion,
  UOptions,
  MetaAction,
} from './types/main';
import { evolve, repeatApply, when } from './util';

export const wrapReducer = <S, PBT extends PayloadConfigByType>(
  reducer: ReducerOf<S, PBT>,
  actionConfigs: PartialActionConfigByType<S, PBT>,
  options?: UOptions
): UReducerOf<S, PBT> => (uState, uReducerAction) => {
  const { state, history } = uState;
  const currentIndex = getCurrentIndex(history);
  const currentBranch = getCurrentBranch(history);

  const mergedOptions: Required<UOptions> = {
    useBranchingHistory: false,
    maxHistoryLength: Infinity,
    ...options,
  };

  const reduce = (action: OriginalActionUnion<PBT>) => (state: S) =>
    reducer(state, action);

  const undoApplied = undo(reduce, actionConfigs);
  const redoApplied = redo(reduce, actionConfigs);

  const action = uReducerAction as MetaAction;

  if (action.type === 'undo') {
    return pipe(
      uState,
      when(() => currentIndex >= 0, undoApplied)
    );
  } else if (action.type === 'redo') {
    return pipe(
      uState,
      when(() => currentIndex < currentBranch.stack.length - 1, redoApplied)
    );
  } else if (action.type === 'timeTravel') {
    const { indexOnBranch, branchId = currentBranch.id } = action.payload;
    if (branchId === currentBranch.id) {
      if (indexOnBranch === currentIndex) {
        return uState;
      } else if (
        indexOnBranch > currentBranch.stack.length - 1 ||
        indexOnBranch < -1
      ) {
        throw new Error(`Invalid index ${indexOnBranch}`);
      } else if (indexOnBranch < currentIndex) {
        return repeatApply(currentIndex - indexOnBranch, undoApplied)(uState);
      } else {
        return repeatApply(indexOnBranch - currentIndex, redoApplied)(uState);
      }
    } else {
      // TODO: implement switch branch
      return uState;
    }
  } else {
    const { type, payload, meta } = action as OriginalUActionUnion<PBT>;
    // TODO: is it safe to just remove 'meta' (what if the original action also had it)?
    const originalAction = { type, payload };

    const newState = reducer(state, originalAction);

    // TODO: what about deep equality?
    if (newState === state) {
      return uState;
    } else {
      const config = actionConfigs[type];
      const skipHistory = !config || meta?.skipHistory;
      // TODO: is check for !config necessary for skipping effects?
      // If used with Redux this reducer may receive unrelated actions.
      const skipEffects = !config || meta?.skipEffects;

      return pipe(
        uState,
        evolve({
          history: skipHistory
            ? identity
            : addHistoryItem(
                {
                  type,
                  payload: config.initPayload(state)(payload),
                  id: v4(),
                  created: new Date(),
                },
                mergedOptions
              ),
          state: () => newState,
          effects: skipEffects ? identity : append(originalAction),
        })
      );
    }
  }
};
