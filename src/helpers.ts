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

export const makeRelativePartialActionConfig = <
  S,
  PBT extends PayloadConfigByType,
  K extends keyof PBT
>({
  makeActionForUndo,
  updatePayload,
}: {
  makeActionForUndo: ActionConvertor<PBT, K>;
  updatePayload?: Updater<S, PBT[K]['undoRedo']>;
}): PartialActionConfig<S, PBT, K> => ({
  initPayload: _ => identity,
  makeActionForUndo,
  makeActionForRedo: identity,
  updatePayloadOnUndo: updatePayload,
  updatePayloadOnRedo: updatePayload,
});

export const makeRelativeActionConfig = <
  S,
  PBT extends PayloadConfigByType,
  K extends keyof PBT
>({
  updateState,
  makeActionForUndo,
  updatePayload,
  updateStateOnUndo,
}: {
  updatePayload?: Updater<S, PBT[K]['undoRedo']>;
  updateState: Updater<PBT[K]['original'], S>;
} & (
  | {
      makeActionForUndo: ActionConvertor<PBT, K>;
      updateStateOnUndo?: never;
    }
  | {
      makeActionForUndo?: never;
      updateStateOnUndo: Updater<PBT[K]['original'], S>;
    }
)): ActionConfig<S, PBT, K> => ({
  updateStateOnRedo: updateState,
  updateStateOnUndo: updateStateOnUndo || updateState,
  ...makeRelativePartialActionConfig({
    updatePayload,
    makeActionForUndo: makeActionForUndo || identity,
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

export const makeDefaultPartialActionConfig = <
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
    makeActionForUndo: ({ type, payload }) => ({
      type,
      payload: payloadMapping.getUndo(payload),
    }),
    makeActionForRedo: ({ type, payload }) => ({
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

export const makeDefaultActionConfig = <
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
