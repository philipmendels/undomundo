import {
  PayloadUndoRedo,
  UndoConfigAbsolute,
  UndoRedoConfigAbsolute,
  Updater,
} from './types';

export const getDefaultUndoConfigAbsolute = <S, PO>(
  updatePayload: Updater<S, PO>
): UndoConfigAbsolute<S, PO, PayloadUndoRedo<PO>> => ({
  updatePayload,
  boxUndoRedo: (undo, redo) => ({ undo, redo }),
  getUndo: boxed => boxed.undo,
  getRedo: boxed => boxed.redo,
});

export const getDefaultUndoRedoConfigAbsolute = <S, PO>(
  updatePayload: Updater<S, PO>,
  updateState: Updater<PO, S>
): UndoRedoConfigAbsolute<S, PO, PayloadUndoRedo<PO>> => ({
  updateState,
  ...getDefaultUndoConfigAbsolute(updatePayload),
});
