import { Endomorphism, PayloadUndoRedo, UndoMap, UndoRedoMap } from './types';

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

export const makeDeltaMap = <S, P>(
  setter: (value: P) => (state: S) => S,
  payloadConverter: Endomorphism<P>
): UndoRedoMap<S, P, P> => ({
  setValue: setter,
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

export const makeUndoRedoMap = <S, V>(
  setter: (value: V) => (state: S) => S,
  getter: (state: S) => V
): UndoRedoMap<S, V, PayloadUndoRedo<V>> => ({
  setValue: setter,
  getValue: state => _ => getter(state),
  payloadMap: {
    getUndo: payload => payload.undo,
    getDrdo: payload => payload.redo,
    init: (undo, redo) => ({ undo, redo }),
  },
});
