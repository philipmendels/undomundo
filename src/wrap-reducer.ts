import { append } from 'fp-ts/Array';
import { identity, pipe } from 'fp-ts/function';
import { v4 } from 'uuid';
import { addHistoryItem, getCurrentBranch, getCurrentIndex } from './internal';
import { HistoryItemUnion } from './types/history';
import {
  PayloadConfigByType,
  PartialActionConfigByType,
  OriginalUActionUnion,
  UReducerOf,
  ReducerOf,
  OriginalActionUnion,
  UOptions,
} from './types/main';
import { add1, evolve, Evolver, modifyArrayAt, subtract1 } from './util';

export const wrapReducer = <S, PBT extends PayloadConfigByType>(
  reducer: ReducerOf<S, PBT>,
  actionConfigs: PartialActionConfigByType<S, PBT>,
  options?: UOptions
): UReducerOf<S, PBT> => (uState, action) => {
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

  if (action.type === 'undo') {
    if (currentIndex >= 0) {
      const currentItem = currentBranch.stack[currentIndex];
      const { type, payload } = currentItem;
      const config = actionConfigs[type];
      const newAction = config.makeActionForUndo({ type, payload });

      return pipe(
        uState,
        evolve({
          history: evolve({
            currentIndex: subtract1,
            branches: config.updatePayloadOnUndo
              ? evolve({
                  [currentBranch.id]: evolve({
                    stack: modifyArrayAt(
                      currentIndex,
                      evolve({
                        payload: config.updatePayloadOnUndo(state),
                      } as Evolver<HistoryItemUnion<PBT>>)
                    ),
                  }),
                })
              : identity,
          }),
          state: reduce({
            ...newAction,
            undoMundo: { isUndo: true },
          }),
          effects: append(newAction),
        })
      );
    } else {
      return uState;
    }
  } else if (action.type === 'redo') {
    if (currentIndex < currentBranch.stack.length - 1) {
      const currentItem = currentBranch.stack[currentIndex + 1];
      const { type, payload } = currentItem;
      const config = actionConfigs[type];
      const newAction = config.makeActionForRedo({ type, payload });

      return pipe(
        uState,
        evolve({
          history: evolve({
            currentIndex: add1,
            branches: config.updatePayloadOnRedo
              ? evolve({
                  [currentBranch.id]: evolve({
                    stack: modifyArrayAt(
                      currentIndex + 1,
                      evolve({
                        payload: config.updatePayloadOnRedo(state),
                      } as Evolver<HistoryItemUnion<PBT>>)
                    ),
                  }),
                })
              : identity,
          }),
          state: reduce(newAction),
          effects: append(newAction),
        })
      );
    } else {
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
