import { map, append } from 'fp-ts/lib/Array';
import { identity, pipe } from 'fp-ts/lib/function';
import {
  UndoConfigAbsolute,
  PayloadConfigByType,
  Reducer,
  ActionUnion,
  PayloadOriginalByType,
  UndoConfigByType,
  StateWithHistory,
  UActions,
  UActionUnion,
  isUndoConfigAbsolute,
  undoConfigAsRelative,
} from './types';
import { add1, evolve, subtract1 } from './util';

const updateOnUndo = <S, PO, PUR>(
  state: S,
  payloadUndoRedo: PUR,
  config: UndoConfigAbsolute<S, PO, PUR>
) =>
  config.boxUndoRedo(
    config.getUndo(payloadUndoRedo),
    config.updatePayload(state)(config.getRedo(payloadUndoRedo))
  );

const updateOnRedo = <S, PO, PUR>(
  state: S,
  payloadUndoRedo: PUR,
  config: UndoConfigAbsolute<S, PO, PUR>
) =>
  config.boxUndoRedo(
    config.updatePayload(state)(config.getUndo(payloadUndoRedo)),
    config.getRedo(payloadUndoRedo)
  );

const makePayload = <S, PO, PUR>(
  state: S,
  payloadOriginal: PO,
  config: UndoConfigAbsolute<S, PO, PUR>
) =>
  config.boxUndoRedo(
    config.updatePayload(state)(payloadOriginal),
    payloadOriginal
  );

export const wrapReducer = <S, PBT extends PayloadConfigByType>(
  reducer: Reducer<S, ActionUnion<PayloadOriginalByType<PBT>>>,
  configs: UndoConfigByType<S, PBT>
): Reducer<
  StateWithHistory<S, PBT>,
  UActions | UActionUnion<PayloadOriginalByType<PBT>>
> => (stateWithHist, action) => {
  const { state, history } = stateWithHist;
  if (action.type === 'undo') {
    if (history.index >= 0) {
      const currentItem = history.stack[history.index];
      const { type, payload } = currentItem;
      const config = configs[type];
      const newAction = isUndoConfigAbsolute(config)
        ? { type, payload: config.getUndo(payload) }
        : undoConfigAsRelative<PBT>(config).undo({ type, payload });
      return pipe(
        stateWithHist,
        evolve({
          history: evolve({
            index: subtract1,
            stack: isUndoConfigAbsolute(config)
              ? map(item =>
                  item === currentItem
                    ? { type, payload: updateOnUndo(state, payload, config) }
                    : item
                )
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
      const currentItem = history.stack[history.index + 1];
      const { type, payload } = currentItem;
      const config = configs[type];
      const newAction = isUndoConfigAbsolute(config)
        ? { type, payload: config.getRedo(payload) }
        : { type, payload };

      return pipe(
        stateWithHist,
        evolve({
          history: evolve({
            index: add1,
            stack: isUndoConfigAbsolute(config)
              ? map(item =>
                  item === currentItem
                    ? { type, payload: updateOnRedo(state, payload, config) }
                    : item
                )
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
    const { type, payload, meta } = action as UActionUnion<
      PayloadOriginalByType<PBT>
    >;
    const originalAction = { type, payload }; // TODO: it is not correct to just remove meta...
    const config = configs[type];
    const skip = meta?.skipAddToHist;
    const newItem = isUndoConfigAbsolute(config)
      ? { type, payload: makePayload(state, payload, config) as any }
      : { type, payload };

    return pipe(
      stateWithHist,
      evolve({
        history: skip
          ? identity
          : evolve({
              index: add1,
              stack: append(newItem),
            }),
        state: prev => reducer(prev, originalAction),
        effects: skip ? identity : append(originalAction),
      })
    );
  }
};

export const undo = () => ({ type: 'undo' } as const);
export const redo = () => ({ type: 'redo' } as const);
