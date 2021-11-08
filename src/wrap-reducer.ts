import { append } from 'fp-ts/Array';
import { flow, identity, pipe } from 'fp-ts/function';
import { v4 } from 'uuid';
import { canRedo, canUndo } from './helpers';
import {
  addHistoryItem,
  getBranchSwitchProps,
  getCurrentBranch,
  redo,
  storeLastGlobalIndex,
  timeTravelCurrentBranch,
  undo,
  updatePath,
} from './internal';
import { makeHistoryReducer } from './make-history-reducer';
import { CustomData, History } from './types/history';
import {
  PayloadConfigByType,
  PartialActionConfigByType,
  OriginalUActionUnion,
  UReducerOf,
  ReducerOf,
  OriginalActionUnion,
  UOptions,
  MetaAction,
  UActionCreatorsByType,
  OriginalPayloadByType,
  HistoryUpdate,
} from './types/main';
import { evolve, mapRecordWithKey, when } from './util';

export type WrapReducerProps<
  S,
  PBT extends PayloadConfigByType,
  CBD extends CustomData = {}
> = {
  reducer: ReducerOf<S, PBT>;
  actionConfigs: PartialActionConfigByType<S, PBT>;
  options?: UOptions;
  initBranchData?: (history: History<PBT, CBD>) => CBD;
};

export const wrapReducer = <
  S,
  PBT extends PayloadConfigByType,
  CBD extends CustomData = {}
>({
  reducer,
  actionConfigs,
  options,
  initBranchData = () => ({} as CBD),
}: WrapReducerProps<S, PBT, CBD>) => {
  const mergedOptions: Required<UOptions> = {
    useBranchingHistory: false,
    maxHistoryLength: Infinity,
    keepOutput: false,
    ...options,
  };

  const historyReducer = makeHistoryReducer<PBT, CBD>();

  const reduceHistory = (action: HistoryUpdate<PBT>) => (
    history: History<PBT, CBD>
  ) => historyReducer(history, action);

  const reduce = (action: OriginalActionUnion<PBT>) => (state: S) =>
    reducer(state, action);

  const uReducer: UReducerOf<S, PBT, CBD> = (uState, uReducerAction) => {
    const { state, history } = uState;
    const currentBranch = getCurrentBranch(history);

    const uStateWithNewOutput: typeof uState =
      mergedOptions.keepOutput || uState.output.length === 0
        ? uState
        : { state, history, output: [] };

    const action = uReducerAction as MetaAction;

    if (action.type === 'undo') {
      return pipe(
        uStateWithNewOutput,
        when(() => canUndo(history), undo(reduce, reduceHistory, actionConfigs))
      );
    } else if (action.type === 'redo') {
      return pipe(
        uStateWithNewOutput,
        when(() => canRedo(history), redo(reduce, actionConfigs))
      );
    } else if (action.type === 'timeTravel') {
      const { indexOnBranch, branchId = currentBranch.id } = action.payload;
      if (branchId === currentBranch.id) {
        return timeTravelCurrentBranch(
          reduce,
          reduceHistory,
          actionConfigs,
          indexOnBranch
        )(uStateWithNewOutput);
      } else {
        const { caIndex, path, parentIndex } = getBranchSwitchProps(
          history,
          branchId
        );
        return pipe(
          uStateWithNewOutput,
          flow(
            evolve({ history: storeLastGlobalIndex() }),
            when(
              () => caIndex < history.currentIndex,
              timeTravelCurrentBranch(
                reduce,
                reduceHistory,
                actionConfigs,
                caIndex
              )
            ),
            evolve({ history: updatePath(path.map(b => b.id)) }),
            // current branch is updated
            timeTravelCurrentBranch(
              reduce,
              reduceHistory,
              actionConfigs,
              parentIndex + 1 + indexOnBranch
            )
          )
        );
      }
    } else if (action.type === 'switchToBranch') {
      const {
        branchId,
        travelTo = 'LAST_COMMON_ACTION_IF_PAST',
      } = action.payload;

      if (branchId === history.currentBranchId) {
        throw new Error(
          'Attempt to switch to a branch that is already current.'
        );
      } else {
        const targetBranch = history.branches[branchId];
        const { caIndex, path, parentIndex } = getBranchSwitchProps(
          history,
          branchId
        );
        return pipe(
          uStateWithNewOutput,
          flow(
            evolve({ history: storeLastGlobalIndex() }),
            when(
              () =>
                caIndex < history.currentIndex ||
                travelTo === 'LAST_COMMON_ACTION',
              timeTravelCurrentBranch(
                reduce,
                reduceHistory,
                actionConfigs,
                caIndex
              )
            ),
            evolve({
              history: updatePath(path.map(b => b.id)),
            }),
            // current branch is updated
            when(
              () => travelTo === 'LAST_KNOWN_POSITION_ON_BRANCH',
              timeTravelCurrentBranch(
                reduce,
                reduceHistory,
                actionConfigs,
                targetBranch.lastGlobalIndex!
              )
            ),
            when(
              () => travelTo === 'HEAD_OF_BRANCH',
              timeTravelCurrentBranch(
                reduce,
                reduceHistory,
                actionConfigs,
                parentIndex + targetBranch.stack.length
              )
            )
          )
        );
      }
    } else if (action.type === 'clearOutput') {
      const deleteCount = action.payload?.deleteCount;
      return {
        ...uStateWithNewOutput,
        output:
          deleteCount === undefined
            ? []
            : uStateWithNewOutput.output.slice(deleteCount),
      };
    } else {
      const { type, payload, meta } = action as OriginalUActionUnion<PBT>;
      // TODO: is it safe to just remove 'meta' (what if the original action also had it)?
      const originalAction = { type, payload };

      const newState = reducer(state, originalAction);

      // TODO: what about deep equality?
      if (newState === state) {
        // or return uState ???
        return uStateWithNewOutput;
      } else {
        const config = actionConfigs[type];
        const skipHistory = !config || meta?.skipHistory;
        // TODO: is check for !config necessary for skipping output?
        // If used with Redux this reducer may receive unrelated actions.
        const skipOutput = !config || meta?.skipOutput;

        return pipe(
          uStateWithNewOutput,
          evolve({
            history: skipHistory
              ? identity
              : addHistoryItem(
                  {
                    type,
                    payload: config.initPayloadInHistory(state)(
                      payload,
                      meta?.undoValue
                    ),
                    id: v4(),
                    created: new Date(),
                  },
                  mergedOptions,
                  initBranchData
                ),
            state: () => newState,
            output: skipOutput ? identity : append(originalAction),
          })
        );
      }
    }
  };

  const actionCreators = mapRecordWithKey(actionConfigs)<
    UActionCreatorsByType<OriginalPayloadByType<PBT>>
  >(type => (payload, options) => ({
    type,
    payload,
    ...(options && { meta: options }),
  }));

  return {
    uReducer,
    actionCreators,
  };
};
