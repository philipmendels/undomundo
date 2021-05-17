import { append } from 'fp-ts/Array';
import { identity, pipe } from 'fp-ts/function';
import { v4 } from 'uuid';
import { getCurrentBranch, getCurrentIndex } from './internal';
import { HistoryItemUnion } from './types/history';
import {
  PayloadConfigByType,
  PartialActionConfigByType,
  OriginalUActionUnion,
  UReducerOf,
  ReducerOf,
  OriginalActionUnion,
} from './types/main';
import { add1, evolve, Evolver, modifyArrayAt, subtract1 } from './util';

export const wrapReducer = <S, PBT extends PayloadConfigByType>(
  reducer: ReducerOf<S, PBT>,
  actionConfigs: PartialActionConfigByType<S, PBT>
): UReducerOf<S, PBT> => (uState, action) => {
  const { state, history } = uState;
  const currentIndex = getCurrentIndex(history);
  const currentBranch = getCurrentBranch(history);

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
            currentPosition: evolve({
              globalIndex: subtract1,
              actionId: () =>
                currentIndex === 0
                  ? 'start'
                  : currentBranch.stack[currentIndex - 1].id,
            }),
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
            currentPosition: evolve({
              globalIndex: add1,
              actionId: () => currentBranch.stack[currentIndex + 1].id,
            }),
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

      const id = v4();

      return pipe(
        uState,
        evolve({
          history: skipHistory
            ? identity
            : evolve({
                currentPosition: evolve({
                  globalIndex: add1,
                  actionId: () => id,
                }),
                branches: evolve({
                  [currentBranch.id]: evolve({
                    stack: append({
                      type,
                      payload: config.initPayload(state)(payload),
                      id,
                      created: new Date(),
                    }),
                  }),
                }),
              }),
          state: () => newState,
          effects: skipEffects ? identity : append(originalAction),
        })
      );
    }
  }
};
