import { append } from 'fp-ts/Array';
import { flow, identity, pipe } from 'fp-ts/function';
import { v4 } from 'uuid';
import {
  addHistoryItem,
  getBranchSwitchProps,
  getCurrentBranch,
  getCurrentIndex,
  redo,
  storeLastGlobalIndex,
  timeTravelCurrentBranch,
  undo,
  updatePath,
} from './internal';
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
} from './types/main';
import { evolve, when } from './util';

export const getOutput = <S, PBT extends PayloadConfigByType>(
  reducer: ReducerOf<S, PBT>,
  actionConfigs: PartialActionConfigByType<S, PBT>
) => {
  const uReducer = wrapReducer(reducer, actionConfigs);
  return (...args: Parameters<UReducerOf<S, PBT>>) => {
    const { output } = uReducer(...args);
    return output;
  };
};

export const wrapReducer = <
  S,
  PBT extends PayloadConfigByType,
  CBD extends CustomData = {}
>(
  reducer: ReducerOf<S, PBT>,
  actionConfigs: PartialActionConfigByType<S, PBT>,
  options?: UOptions,
  initializeCustomBranchData: (history: History<PBT, CBD>) => CBD = () =>
    ({} as CBD)
): UReducerOf<S, PBT, CBD> => {
  const mergedOptions: Required<UOptions> = {
    useBranchingHistory: false,
    maxHistoryLength: Infinity,
    keepOutput: false,
    ...options,
  };

  const reduce = (action: OriginalActionUnion<PBT>) => (state: S) =>
    reducer(state, action);

  return (uState, uReducerAction) => {
    const { state, history } = uState;
    const currentIndex = getCurrentIndex(history);
    const currentBranch = getCurrentBranch(history);

    const uStateWithNewOutput: typeof uState =
      mergedOptions.keepOutput || uState.output.length === 0
        ? uState
        : { state, history, output: [] };

    const action = uReducerAction as MetaAction;

    if (action.type === 'undo') {
      return pipe(
        uStateWithNewOutput,
        when(() => currentIndex >= 0, undo(reduce, actionConfigs))
      );
    } else if (action.type === 'redo') {
      return pipe(
        uStateWithNewOutput,
        when(
          () => currentIndex < currentBranch.stack.length - 1,
          redo(reduce, actionConfigs)
        )
      );
    } else if (action.type === 'timeTravel') {
      const { indexOnBranch, branchId = currentBranch.id } = action.payload;
      if (branchId === currentBranch.id) {
        return timeTravelCurrentBranch(
          reduce,
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
              timeTravelCurrentBranch(reduce, actionConfigs, caIndex)
            ),
            evolve({ history: updatePath(path.map(b => b.id)) }),
            // current branch is updated
            timeTravelCurrentBranch(
              reduce,
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
              timeTravelCurrentBranch(reduce, actionConfigs, caIndex)
            ),
            evolve({
              history: updatePath(path.map(b => b.id)),
            }),
            // current branch is updated
            when(
              () => travelTo === 'LAST_KNOWN_POSITION_ON_BRANCH',
              timeTravelCurrentBranch(
                reduce,
                actionConfigs,
                targetBranch.lastGlobalIndex!
              )
            ),
            when(
              () => travelTo === 'HEAD_OF_BRANCH',
              timeTravelCurrentBranch(
                reduce,
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
                    payload: config.initPayload(state)(
                      payload,
                      meta?.payloadUndo
                    ),
                    id: v4(),
                    created: new Date(),
                  },
                  mergedOptions,
                  initializeCustomBranchData
                ),
            state: () => newState,
            output: skipOutput ? identity : append(originalAction),
          })
        );
      }
    }
  };
};
