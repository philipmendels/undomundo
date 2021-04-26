import { Endomorphism, PayloadUndoRedo, UndoMap } from './types';

export const makePayloadDeltaMap = <S, P>(
  payloadConverter: Endomorphism<P>
): UndoMap<S, P, P> => ({
  getValue: _ => payload => payload,
  payloadMap: {
    getUndo: payloadConverter,
    getDrdo: payload => payload,
    init: (_, redo) => redo,
  },
});

export const makePayloadUndoRedoMap = <S, V>(
  getter: (state: S) => V
): UndoMap<S, V, PayloadUndoRedo<V>> => ({
  getValue: state => _ => getter(state),
  payloadMap: {
    getUndo: payload => payload.undo,
    getDrdo: payload => payload.redo,
    init: (undo, redo) => ({ undo, redo }),
  },
});
