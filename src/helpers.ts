import { identity } from 'fp-ts/function';
import { v4 } from 'uuid';
import { getCurrentBranch } from './internal';
import { CustomData, History } from './types/history';
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
  UReducerOf,
  UState,
} from './types/main';

export const makeRelativePartialActionConfig = <
  S,
  PBT extends PayloadConfigByType,
  K extends keyof PBT
>({
  makeActionForUndo,
  updateHistory,
}: {
  makeActionForUndo: ActionConvertor<PBT, K>;
  updateHistory?: Updater<S, PBT[K]['history']>;
}): PartialActionConfig<S, PBT, K> => ({
  initPayloadInHistory: _ => identity,
  makeActionForUndo,
  getPayloadForRedo: identity,
  updateHistoryOnUndo: updateHistory,
  updateHistoryOnRedo: updateHistory,
});

export const makeRelativeActionConfig = <
  S,
  PBT extends PayloadConfigByType,
  K extends keyof PBT
>({
  updateState,
  makeActionForUndo,
  updateHistory,
}: {
  updateState: Updater<PBT[K]['original'], S>;
  makeActionForUndo: ActionConvertor<PBT, K>;
  updateHistory?: Updater<S, PBT[K]['history']>;
}): ActionConfig<S, PBT, K> => ({
  updateState: updateState,
  ...makeRelativePartialActionConfig({
    updateHistory,
    makeActionForUndo,
  }),
});

export const defaultPayloadMapping: PayloadMapping<
  unknown,
  DefaultPayload<unknown>
> = {
  composeUndoRedo: (undo, redo) => ({ undo, redo }),
  getUndo: ({ undo }) => undo,
  getRedo: ({ redo }) => redo,
};

export const fromToPayloadMapping: PayloadMapping<
  unknown,
  FromToPayload<unknown>
> = {
  composeUndoRedo: (from, to) => ({ from, to }),
  getUndo: ({ from }) => from,
  getRedo: ({ to }) => to,
};

export const tuplePayloadMapping: PayloadMapping<
  unknown,
  TuplePayload<unknown>
> = {
  composeUndoRedo: (undo, redo) => [undo, redo],
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
  getValueFromState,
  updateHistory,
}: {
  getValueFromState: (state: S) => PBT[K]['original'];
  updateHistory?: Updater<PBT[K]['original'], PBT[K]['original']>;
}): PartialActionConfig<S, PBT, K> => {
  return {
    initPayloadInHistory: state => (redoValue, undoValue) =>
      payloadMapping.composeUndoRedo(
        // we should allow for a null undoValue
        undoValue === undefined ? getValueFromState(state) : undoValue,
        redoValue
      ),
    makeActionForUndo: ({ type, payload, ...rest }) => ({
      // by default we include the ...rest (which is PBT[K]['extra'])
      ...rest,
      type,
      payload: payloadMapping.getUndo(payload),
    }),
    getPayloadForRedo: payloadMapping.getRedo,
    updateHistoryOnUndo:
      updateHistory &&
      (state => undoRedo =>
        payloadMapping.composeUndoRedo(
          payloadMapping.getUndo(undoRedo),
          updateHistory!(getValueFromState(state))(
            payloadMapping.getRedo(undoRedo)
          )
        )),
    updateHistoryOnRedo:
      updateHistory &&
      (state => undoRedo =>
        payloadMapping.composeUndoRedo(
          updateHistory(getValueFromState(state))(
            payloadMapping.getUndo(undoRedo)
          ),
          payloadMapping.getRedo(undoRedo)
        )),
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
  updateState,
  updateHistory,
  getValueFromState,
}: {
  updateState: Updater<PBT[K]['original'], S>;
  getValueFromState: (state: S) => PBT[K]['original'];
  updateHistory?: Updater<PBT[K]['original'], PBT[K]['original']>;
}): ActionConfig<S, PBT, K> => ({
  updateState: updateState,
  ...makeAbsolutePartialActionConfig(payloadMapping)({
    updateHistory,
    getValueFromState,
  }),
});

export const makeDefaultActionConfig = makeAbsoluteActionConfig(
  defaultPayloadMapping
);

// This is only useful if you have a reducer
// with the option keepOutput: true
export const getOutputFunction = <
  S,
  PBT extends PayloadConfigByType,
  CBD extends CustomData = {}
>(
  uReducer: UReducerOf<S, PBT, CBD>
) => {
  return ([uState, action]: Parameters<UReducerOf<S, PBT, CBD>>) => {
    const stateWithEmptyOutput: UState<S, PBT, CBD> = {
      ...uState,
      stateUpdates: [],
    };
    const { stateUpdates } = uReducer(stateWithEmptyOutput, action);
    return stateUpdates;
  };
};

export const initUState = <
  S,
  PBT extends PayloadConfigByType,
  CD extends CustomData = {}
>(
  state: S,
  custom = {} as CD
): UState<S, PBT, CD> => ({
  historyUpdates: [],
  stateUpdates: [],
  history: initHistory(custom),
  state,
});

export const initHistory = <
  PBT extends PayloadConfigByType,
  CD extends CustomData = {}
>(
  custom = {} as CD
): History<PBT, CD> => {
  const initialBranchId = v4();
  return {
    currentIndex: -1,
    branches: {
      [initialBranchId]: {
        id: initialBranchId,
        created: new Date(),
        stack: [],
        custom,
      },
    },
    currentBranchId: initialBranchId,
    stats: {
      branchCounter: 1,
      actionCounter: 0,
    },
  };
};

export const canRedo = <PBT extends PayloadConfigByType, CD extends CustomData>(
  history: History<PBT, CD>
) => history.currentIndex < getCurrentBranch(history).stack.length - 1;

export const canUndo = <PBT extends PayloadConfigByType, CD extends CustomData>(
  history: History<PBT, CD>
) => history.currentIndex >= 0;

export { getCurrentBranch };
