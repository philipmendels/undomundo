import { append } from 'fp-ts/Array';
import { identity, pipe } from 'fp-ts/function';
import {
  UndoConfigAbsolute,
  PayloadConfigByType,
  UndoConfigByType,
  isUndoConfigAbsolute,
  undoConfigAsRelative,
  HistoryItemUnion,
  OriginalActionUnion,
  OriginalUActionUnion,
  UReducerOf,
  ReducerOf,
} from './types';
import { add1, evolve, subtract1, updateArrayAt } from './util';

const updateOnUndo = <S, PO, PUR>(
  state: S,
  payloadUndoRedo: PUR,
  config: UndoConfigAbsolute<S, PO, PUR>
): PUR =>
  config.boxUndoRedo(
    config.getUndo(payloadUndoRedo),
    config.updatePayload(state)(config.getRedo(payloadUndoRedo))
  );

const updateOnRedo = <S, PO, PUR>(
  state: S,
  payloadUndoRedo: PUR,
  config: UndoConfigAbsolute<S, PO, PUR>
): PUR =>
  config.boxUndoRedo(
    config.updatePayload(state)(config.getUndo(payloadUndoRedo)),
    config.getRedo(payloadUndoRedo)
  );

const makePayload = <S, PO, PUR>(
  state: S,
  payloadOriginal: PO,
  config: UndoConfigAbsolute<S, PO, PUR>
): PUR =>
  config.boxUndoRedo(
    config.updatePayload(state)(payloadOriginal),
    payloadOriginal
  );

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
      const newAction = isUndoConfigAbsolute<S, PBT>(config)
        ? { type, payload: config.getUndo(payload) }
        : undoConfigAsRelative<PBT>(config).undo({ type, payload });

      return pipe(
        stateWithHist,
        evolve({
          history: evolve({
            index: subtract1,
            stack: isUndoConfigAbsolute<S, PBT>(config)
              ? updateArrayAt(currentIndex, {
                  type,
                  payload: updateOnUndo(state, payload, config),
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
      const newAction: OriginalActionUnion<PBT> = isUndoConfigAbsolute<S, PBT>(
        config
      )
        ? { type, payload: config.getRedo(payload) }
        : { type, payload };

      return pipe(
        stateWithHist,
        evolve({
          history: evolve({
            index: add1,
            stack: isUndoConfigAbsolute<S, PBT>(config)
              ? updateArrayAt(currentIndex, {
                  type,
                  payload: updateOnRedo(state, payload, config),
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

      if (config && isUndoConfigAbsolute<S, PBT>(config)) {
        // TODO: is this optimization safe?
        if (config.updatePayload(state)(payload) === payload) {
          return stateWithHist;
        }
      }

      return pipe(
        stateWithHist,
        evolve({
          history: skipHistory
            ? identity
            : evolve({
                index: add1,
                stack: append(
                  (isUndoConfigAbsolute<S, PBT>(config)
                    ? {
                        type,
                        payload: makePayload(state, payload, config),
                      }
                    : { type, payload }) as HistoryItemUnion<PBT>
                ),
              }),
          state: () => newState,
          // TODO: is check for !config necessary here?
          // If used with Redux this reducer may receive unrelated actions.
          effects: !config ? identity : append(originalAction),
        })
      );
    }
  }
};
