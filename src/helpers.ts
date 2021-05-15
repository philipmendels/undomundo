import { identity } from 'fp-ts/function';
import {
  ActionConvertor,
  PayloadConfigByType,
  PayloadMapping,
  DefaultPayload,
  PartialActionConfig,
  ActionConfig,
  Updater,
  DefaultKeysOf,
} from './types';

export const getRelativePartialActionConfig = <
  S,
  PBT extends PayloadConfigByType,
  K extends keyof PBT
>({
  getActionForUndo,
  updatePayload,
}: {
  getActionForUndo: ActionConvertor<PBT, K>;
  updatePayload?: Updater<S, PBT[K]['undoRedo']>;
}): PartialActionConfig<S, PBT, K> => ({
  initPayload: _ => identity,
  getActionForUndo,
  getActionForRedo: identity,
  updatePayloadOnUndo: updatePayload,
  updatePayloadOnRedo: updatePayload,
});

export const getRelativeActionConfig = <
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
): ActionConfig<S, PBT, K> => ({
  updateStateOnRedo: props.updateState,
  updateStateOnUndo: props.updateStateOnUndo || props.updateState,
  ...getRelativePartialActionConfig({
    updatePayload: props.updatePayload,
    getActionForUndo: props.getActionForUndo || identity,
  }),
});

// export const getDefaultPayloadMapping = <T>(): PayloadMapping<
//   T,
//   PayloadUndoRedo<T>
// > => ({
//   boxUndoRedo: (undo, redo) => ({ undo, redo }),
//   getUndo: boxed => boxed.undo,
//   getRedo: boxed => boxed.redo,
// });

export const defaultPayloadMapping = {
  boxUndoRedo: <PO>(undo: PO, redo: PO) => ({ undo, redo }),
  getUndo: <PO>({ undo }: DefaultPayload<PO>) => undo,
  getRedo: <PO>({ redo }: DefaultPayload<PO>) => redo,
};

export const getAbsolutePartialActionConfig = <
  PBT extends PayloadConfigByType,
  K extends DefaultKeysOf<PBT>,
  S
>({
  updatePayload,
}: {
  updatePayload: Updater<S, PBT[K]['original']>;
}) =>
  makeAbsolutePartialActionConfig<PBT, K, S>({
    payloadMapping: defaultPayloadMapping,
    updatePayload,
  });

export const makeAbsolutePartialActionConfig = <
  PBT extends PayloadConfigByType,
  K extends keyof PBT,
  S
>({
  payloadMapping,
  updatePayload,
}: {
  payloadMapping: PayloadMapping<PBT[K]['original'], PBT[K]['undoRedo']>;
  updatePayload: Updater<S, PBT[K]['original']>;
}): PartialActionConfig<S, PBT, K> => {
  return {
    initPayload: state => original =>
      payloadMapping.boxUndoRedo(updatePayload(state)(original), original),
    getActionForUndo: ({ type, payload }) => ({
      type,
      payload: payloadMapping.getUndo(payload),
    }),
    getActionForRedo: ({ type, payload }) => ({
      type,
      payload: payloadMapping.getRedo(payload),
    }),
    updatePayloadOnUndo: state => undoRedo =>
      payloadMapping.boxUndoRedo(
        payloadMapping.getUndo(undoRedo),
        updatePayload(state)(payloadMapping.getRedo(undoRedo))
      ),
    updatePayloadOnRedo: state => undoRedo =>
      payloadMapping.boxUndoRedo(
        updatePayload(state)(payloadMapping.getUndo(undoRedo)),
        payloadMapping.getRedo(undoRedo)
      ),
  };
};

// export const makeAbsolutePartialActionConfig2 = <
//   PBT extends PayloadConfigByType,
//   K extends keyof PBT
// >(
//   payloadMapping: PayloadMapping<PBT[K]['original'], PBT[K]['undoRedo']>
// ) => <S>({
//   updatePayload,
// }: {
//   updatePayload: Updater<S, PBT[K]['original']>;
// }): PartialActionConfig<S, PBT, K> => {
//   return {
//     initPayload: state => original =>
//       payloadMapping.boxUndoRedo(updatePayload(state)(original), original),
//     getActionForUndo: ({ type, payload }) => ({
//       type,
//       payload: payloadMapping.getUndo(payload),
//     }),
//     getActionForRedo: ({ type, payload }) => ({
//       type,
//       payload: payloadMapping.getRedo(payload),
//     }),
//     updatePayloadOnUndo: state => undoRedo =>
//       payloadMapping.boxUndoRedo(
//         payloadMapping.getUndo(undoRedo),
//         updatePayload(state)(payloadMapping.getRedo(undoRedo))
//       ),
//     updatePayloadOnRedo: state => undoRedo =>
//       payloadMapping.boxUndoRedo(
//         updatePayload(state)(payloadMapping.getUndo(undoRedo)),
//         payloadMapping.getRedo(undoRedo)
//       ),
//   };
// };

export const getAbsoluteActionConfig = <
  PBT extends PayloadConfigByType,
  K extends DefaultKeysOf<PBT>,
  S
>({
  updatePayload,
  updateState,
}: {
  updatePayload: Updater<S, PBT[K]['original']>;
  updateState: Updater<PBT[K]['original'], S>;
}) =>
  makeAbsoluteActionConfig({
    payloadMapping: defaultPayloadMapping,
    updatePayload,
    updateState,
  });

export const makeAbsoluteActionConfig = <
  S,
  PBT extends PayloadConfigByType,
  K extends keyof PBT
>({
  payloadMapping,
  updatePayload,
  updateState,
}: {
  payloadMapping: PayloadMapping<PBT[K]['original'], PBT[K]['undoRedo']>;
  updatePayload: Updater<S, PBT[K]['original']>;
  updateState: Updater<PBT[K]['original'], S>;
}): ActionConfig<S, PBT, K> => ({
  updateStateOnRedo: updateState,
  updateStateOnUndo: updateState,
  ...makeAbsolutePartialActionConfig({ payloadMapping, updatePayload }),
});

// export const makeAbsoluteActionConfig2 = <
//   S,
//   PBT extends PayloadConfigByType,
//   K extends keyof PBT
// >(
//   payloadMapping: PayloadMapping<PBT[K]['original'], PBT[K]['undoRedo']>
// ) => ({
//   updatePayload,
//   updateState,
// }: {
//   updatePayload: Updater<S, PBT[K]['original']>;
//   updateState: Updater<PBT[K]['original'], S>;
// }): ActionConfig<S, PBT, K> => ({
//   updateStateOnRedo: updateState,
//   updateStateOnUndo: updateState,
//   ...makeAbsolutePartialActionConfig({ payloadMapping, updatePayload }),
// });
