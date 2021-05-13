import { append } from 'fp-ts/Array';
import { identity, pipe } from 'fp-ts/function';
import {
  PayloadConfigByType,
  UndoConfigByType,
  OriginalUActionUnion,
  UReducerOf,
  ReducerOf,
} from './types';
import { add1, evolve, subtract1, updateArrayAt } from './util';

export const wrapReducer = <S, PBT extends PayloadConfigByType>(
  reducer: ReducerOf<S, PBT>,
  configs: UndoConfigByType<S, PBT>
): UReducerOf<S, PBT> => (stateWithHist, action) => {
  const { state, history } = stateWithHist;
  if (action.type === 'undo') {
    if (history.index >= 0) {
      const currentIndex = history.index;
      const currentItem = history.stack[currentIndex];
      const { type, payload } = currentItem;
      const config = configs[type];
      const newAction = config.getActionForUndo({ type, payload });

      return pipe(
        stateWithHist,
        evolve({
          history: evolve({
            index: subtract1,
            stack: config.updatePayloadOnUndo
              ? updateArrayAt(currentIndex, {
                  type,
                  payload: config.updatePayloadOnUndo(state)(payload),
                })
              : identity,
          }),
          state: prev => reducer(prev, newAction),
          effects: append(newAction),
        })
      );
    } else {
      return stateWithHist;
    }
  } else if (action.type === 'redo') {
    if (history.index < history.stack.length - 1) {
      const currentIndex = history.index + 1;
      const currentItem = history.stack[currentIndex];
      const { type, payload } = currentItem;
      const config = configs[type];
      const newAction = config.getActionForRedo({ type, payload });

      return pipe(
        stateWithHist,
        evolve({
          history: evolve({
            index: add1,
            stack: config.updatePayloadOnRedo
              ? updateArrayAt(currentIndex, {
                  type,
                  payload: config.updatePayloadOnRedo(state)(payload),
                })
              : identity,
          }),
          state: prev => reducer(prev, newAction),
          effects: append(newAction),
        })
      );
    } else {
      return stateWithHist;
    }
  } else {
    const { type, payload, meta } = action as OriginalUActionUnion<PBT>;
    // TODO: is it safe to just remove 'meta' (what if the original action also had it)?
    const originalAction = { type, payload };

    const newState = reducer(state, originalAction);

    // TODO: what about deep equality?
    if (newState === state) {
      return stateWithHist;
    } else {
      const config = configs[type];
      const skipHistory = !config || meta?.skipHistory;
      // TODO: is check for !config necessary for skipping effects?
      // If used with Redux this reducer may receive unrelated actions.
      const skipEffects = !config || meta?.skipEffects;

      return pipe(
        stateWithHist,
        evolve({
          history: skipHistory
            ? identity
            : evolve({
                index: add1,
                stack: append({
                  type,
                  payload: config.initPayload(state)(payload),
                }),
              }),
          state: () => newState,
          effects: skipEffects ? identity : append(originalAction),
        })
      );
    }
  }
};
