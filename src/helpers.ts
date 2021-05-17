import { identity } from 'fp-ts/function';
import {
  ActionConvertor,
  PayloadConfigByType,
  PayloadMapping,
  DefaultPayload,
  PartialActionConfig,
  ActionConfig,
  Updater,
  AssociatedKeysOf,
  FromToPayload,
  TuplePayload,
} from './types/main';

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

export const defaultPayloadMapping: PayloadMapping<
  unknown,
  DefaultPayload<unknown>
> = {
  boxUndoRedo: (undo, redo) => ({ undo, redo }),
  getUndo: ({ undo }) => undo,
  getRedo: ({ redo }) => redo,
};

export const fromToPayloadMapping: PayloadMapping<
  unknown,
  FromToPayload<unknown>
> = {
  boxUndoRedo: (from, to) => ({ from, to }),
  getUndo: ({ from }) => from,
  getRedo: ({ to }) => to,
};

export const tuplePayloadMapping: PayloadMapping<
  unknown,
  TuplePayload<unknown>
> = {
  boxUndoRedo: (undo, redo) => [undo, redo],
  getUndo: ([undo]) => undo,
  getRedo: ([_, redo]) => redo,
};

export const makeAbsolutePartialActionConfig = <PUR>(
  payloadMapping: PayloadMapping<unknown, PUR>
) => <
  PBT extends PayloadConfigByType,
  K extends AssociatedKeysOf<PBT, PUR>,
  S
>({
  updatePayload,
}: {
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

export const makeDefaultPartialActionConfig = makeAbsolutePartialActionConfig(
  defaultPayloadMapping
);

export const makeAbsoluteActionConfig = <PUR>(
  payloadMapping: PayloadMapping<unknown, PUR>
) => <
  PBT extends PayloadConfigByType,
  K extends AssociatedKeysOf<PBT, PUR>,
  S
>({
  updatePayload,
  updateState,
}: {
  updatePayload: Updater<S, PBT[K]['original']>;
  updateState: Updater<PBT[K]['original'], S>;
}): ActionConfig<S, PBT, K> => ({
  updateStateOnRedo: updateState,
  updateStateOnUndo: updateState,
  ...makeAbsolutePartialActionConfig(payloadMapping)({ updatePayload }),
});

export const makeDefaultActionConfig = makeAbsoluteActionConfig(
  defaultPayloadMapping
);
