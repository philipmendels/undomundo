import { identity } from 'fp-ts/lib/function';
import {
  ActionConvertor,
  PayloadConfigByType,
  PayloadMapping,
  PayloadUndoRedo,
  UndoConfig,
  UndoRedoConfig,
  // UndoConfigAbsolute,
  // UndoRedoConfigAbsolute,
  Updater,
} from './types';

export const makeRelativeUndoConfig = <
  S,
  PBT extends PayloadConfigByType,
  K extends keyof PBT
>({
  getActionForUndo,
  updatePayload,
}: {
  getActionForUndo: ActionConvertor<PBT, K>;
  updatePayload?: Updater<S, PBT[K]['undoRedo']>;
}): UndoConfig<S, PBT, K> => ({
  initPayload: _ => identity,
  getActionForUndo,
  getActionForRedo: identity,
  updatePayloadOnUndo: updatePayload,
  updatePayloadOnRedo: updatePayload,
});

export const makeRelativeUndoRedoConfig = <
  S,
  PBT extends PayloadConfigByType,
  K extends keyof PBT
>(
  props: {
    updatePayload?: Updater<S, PBT[K]['undoRedo']>;
    updateState: Updater<PBT[K]['original'], S>;
  } & (
    | {
        getActionForUndo: ActionConvertor<PBT, K>;
        updateStateOnUndo?: never;
      }
    | {
        getActionForUndo?: never;
        updateStateOnUndo: Updater<PBT[K]['original'], S>;
      }
  )
): UndoRedoConfig<S, PBT, K> => ({
  updateStateOnRedo: props.updateState,
  updateStateOnUndo: props.updateStateOnUndo || props.updateState,
  ...makeRelativeUndoConfig({
    updatePayload: props.updatePayload,
    getActionForUndo: props.getActionForUndo || identity,
  }),
});

const getDefaultConfig = <T = unknown>(): PayloadMapping<
  T,
  PayloadUndoRedo<T>
> => ({
  boxUndoRedo: (undo, redo) => ({ undo, redo }),
  getUndo: boxed => boxed.undo,
  getRedo: boxed => boxed.redo,
});

export const makeAbsoluteUndoConfig = <
  S,
  PBT extends PayloadConfigByType,
  K extends keyof PBT
>(props: {
  updatePayload: Updater<S, PBT[K]['original']>;
}): UndoConfig<S, PBT, K> => {
  const config = getDefaultConfig();
  return {
    initPayload: state => original =>
      config.boxUndoRedo(props.updatePayload(state)(original), original),
    getActionForUndo: ({ type, payload }) => ({
      type,
      payload: config.getUndo(payload),
    }),
    getActionForRedo: ({ type, payload }) => ({
      type,
      payload: config.getRedo(payload),
    }),
    updatePayloadOnUndo: state => undoRedo =>
      config.boxUndoRedo(
        config.getUndo(undoRedo),
        props.updatePayload(state)(config.getRedo(undoRedo))
      ),
    updatePayloadOnRedo: state => undoRedo =>
      config.boxUndoRedo(
        props.updatePayload(state)(config.getUndo(undoRedo)),
        config.getRedo(undoRedo)
      ),
  };
};

export const makeAbsoluteUndoRedoConfig = <
  S,
  PBT extends PayloadConfigByType,
  K extends keyof PBT
>({
  updatePayload,
  updateState,
}: {
  updatePayload: Updater<S, PBT[K]['original']>;
  updateState: Updater<PBT[K]['original'], S>;
}): UndoRedoConfig<S, PBT, K> => ({
  updateStateOnRedo: updateState,
  updateStateOnUndo: updateState,
  ...makeAbsoluteUndoConfig({ updatePayload }),
});

// export const getDefaultUndoConfigAbsolute = <S, PO>(
//   updatePayload: Updater<S, PO>
// ): UndoConfigAbsolute<S, PO, PayloadUndoRedo<PO>> => ({
//   updatePayload,
//   boxUndoRedo: (undo, redo) => ({ undo, redo }),
//   getUndo: boxed => boxed.undo,
//   getRedo: boxed => boxed.redo,
// });

// export const getDefaultUndoRedoConfigAbsolute = <S, PO>(
//   updatePayload: Updater<S, PO>,
//   updateState: Updater<PO, S>
// ): UndoRedoConfigAbsolute<S, PO, PayloadUndoRedo<PO>> => ({
//   updateState,
//   ...getDefaultUndoConfigAbsolute(updatePayload),
// });

// const updateOnUndo = <S, PO, PUR>(
//   state: S,
//   payloadUndoRedo: PUR,
//   config: UndoConfigAbsolute<S, PO, PUR>
// ): PUR =>
//   config.boxUndoRedo(
//     config.getUndo(payloadUndoRedo),
//     config.updatePayload(state)(config.getRedo(payloadUndoRedo))
//   );

// const updateOnRedo = <S, PO, PUR>(
//   state: S,
//   payloadUndoRedo: PUR,
//   config: UndoConfigAbsolute<S, PO, PUR>
// ): PUR =>
//   config.boxUndoRedo(
//     config.updatePayload(state)(config.getUndo(payloadUndoRedo)),
//     config.getRedo(payloadUndoRedo)
//   );

// const makePayload = <S, PO, PUR>(
//   state: S,
//   payloadOriginal: PO,
//   config: UndoConfigAbsolute<S, PO, PUR>
// ): PUR =>
//   config.boxUndoRedo(
//     config.updatePayload(state)(payloadOriginal),
//     payloadOriginal
//   );
