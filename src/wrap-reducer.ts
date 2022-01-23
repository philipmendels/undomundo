import { flow, pipe } from 'fp-ts/function';
import { v4 } from 'uuid';
import { canRedo, canUndo, getAction } from './helpers';
import {
  getBranchSwitchProps,
  getCurrentBranch,
  isAbsoluteConfig,
  isSyncAction,
  redo,
  timeTravelCurrentBranch,
  undo,
} from './internal';
import { makeHistoryReducer } from './make-history-reducer';
import {
  CustomData,
  History,
  HistoryItemUnion,
  InitBranchData,
} from './types/history';
import {
  PayloadConfigByType,
  PartialActionConfigByType,
  UReducerOf,
  ReducerOf,
  UOptions,
  MetaAction,
  UActionCreatorsByType,
  HistoryUpdate,
  StateActionUnion,
  UActionUnion,
  SyncActionUnion,
  UActionCreator,
  StateUpdate,
} from './types/main';
import { append, evolve, mapRecordWithKey, merge, when } from './util';

const storeIndexAction: HistoryUpdate<any> = { type: 'STORE_INDEX' };

export type WrapReducerProps<
  S,
  PBT extends PayloadConfigByType,
  CBD extends CustomData = {},
  NUA = never
> = {
  reducer: ReducerOf<S, PBT, NUA>;
  actionConfigs: PartialActionConfigByType<S, PBT>;
  options?: UOptions<S>;
  initBranchData?: InitBranchData<PBT, CBD>;
};

export const wrapReducer = <
  S,
  PBT extends PayloadConfigByType,
  CBD extends CustomData = {},
  NUA = never
>({
  reducer,
  actionConfigs,
  options = {},
  initBranchData,
}: WrapReducerProps<S, PBT, CBD, NUA>) => {
  const {
    keepStateUpdates = false,
    keepHistoryUpdates = false,
    disableUpdateHistory = false,
    isStateEqual = () => false,
    ...historyOptions
  } = options;

  const historyReducer = makeHistoryReducer<PBT, CBD>({
    options: historyOptions,
    initBranchData,
  });

  const reduceHistory = (action: HistoryUpdate<PBT>) => (
    history: History<PBT, CBD>
  ) => historyReducer(history, action);

  const reduce = (action: StateActionUnion<PBT>) => (state: S) =>
    reducer(state, action);

  const uReducer: UReducerOf<S, PBT, CBD, NUA> = (uState, uReducerAction) => {
    const uStateWithNewOutput = pipe(
      uState,
      when(
        () => !keepStateUpdates && uState.stateUpdates.length > 0,
        merge({ stateUpdates: [] })
      ),
      when(
        () => !keepHistoryUpdates && uState.historyUpdates.length > 0,
        merge({ historyUpdates: [] })
      )
    );

    const { state, history } = uStateWithNewOutput;
    const currentBranch = getCurrentBranch(history);

    const action = uReducerAction as MetaAction;

    if (action.type === 'undo') {
      return pipe(
        uStateWithNewOutput,
        when(
          () => canUndo(history),
          undo(reduce, reduceHistory, actionConfigs, disableUpdateHistory)
        )
      );
    } else if (action.type === 'redo') {
      return pipe(
        uStateWithNewOutput,
        when(
          () => canRedo(history),
          redo(reduce, reduceHistory, actionConfigs, disableUpdateHistory)
        )
      );
    } else if (action.type === 'timeTravel') {
      const { indexOnBranch, branchId = currentBranch.id } = action.payload;
      if (branchId === currentBranch.id) {
        return timeTravelCurrentBranch(
          reduce,
          reduceHistory,
          actionConfigs,
          disableUpdateHistory,
          indexOnBranch
        )(uStateWithNewOutput);
      } else {
        const { caIndex, pathToTarget, parentIndex } = getBranchSwitchProps(
          history,
          branchId
        );
        const rebuildBranchesAction: HistoryUpdate<PBT> = {
          type: 'REBUILD_BRANCHES',
          payload: pathToTarget,
        };

        return pipe(
          uStateWithNewOutput,
          flow(
            evolve({
              history: reduceHistory(storeIndexAction),
            }),
            when(
              () => caIndex < history.currentIndex,
              timeTravelCurrentBranch(
                reduce,
                reduceHistory,
                actionConfigs,
                disableUpdateHistory,
                caIndex
              )
            ),
            evolve({
              history: reduceHistory(rebuildBranchesAction),
              historyUpdates: append<HistoryUpdate<PBT>>(rebuildBranchesAction),
            }),
            // current branch is updated
            timeTravelCurrentBranch(
              reduce,
              reduceHistory,
              actionConfigs,
              disableUpdateHistory,
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
        const { caIndex, pathToTarget, parentIndex } = getBranchSwitchProps(
          history,
          branchId
        );

        const rebuildBranchesAction: HistoryUpdate<PBT> = {
          type: 'REBUILD_BRANCHES',
          payload: pathToTarget,
        };

        return pipe(
          uStateWithNewOutput,
          flow(
            evolve({
              history: reduceHistory(storeIndexAction),
              historyUpdates: append<HistoryUpdate<PBT>>(storeIndexAction),
            }),
            when(
              () =>
                caIndex < history.currentIndex ||
                travelTo === 'LAST_COMMON_ACTION',
              timeTravelCurrentBranch(
                reduce,
                reduceHistory,
                actionConfigs,
                disableUpdateHistory,
                caIndex
              )
            ),
            evolve({
              history: reduceHistory(rebuildBranchesAction),
              historyUpdates: append<HistoryUpdate<PBT>>(rebuildBranchesAction),
            }),
            // current branch is updated
            when(
              () => travelTo === 'LAST_KNOWN_POSITION_ON_BRANCH',
              timeTravelCurrentBranch(
                reduce,
                reduceHistory,
                actionConfigs,
                disableUpdateHistory,
                targetBranch.lastGlobalIndex!
              )
            ),
            when(
              () => travelTo === 'HEAD_OF_BRANCH',
              timeTravelCurrentBranch(
                reduce,
                reduceHistory,
                actionConfigs,
                disableUpdateHistory,
                parentIndex + targetBranch.stack.length
              )
            )
          )
        );
      }
    } else if (action.type === 'clearStateUpdates') {
      const deleteCount = action.payload;
      return {
        ...uStateWithNewOutput,
        stateUpdates:
          deleteCount === undefined
            ? []
            : uStateWithNewOutput.stateUpdates.slice(deleteCount),
      };
    } else if (action.type === 'clearHistoryUpdates') {
      const deleteCount = action.payload;
      return {
        ...uStateWithNewOutput,
        historyUpdates:
          deleteCount === undefined
            ? []
            : uStateWithNewOutput.historyUpdates.slice(deleteCount),
      };
    } else {
      // The action can have any shape here, because in Redux every action
      // hits every reducer.

      // meta actions (e.g. 'undo') are alread handled above.

      const actionCasted = action as UActionUnion<PBT> | SyncActionUnion<PBT>;

      if (isSyncAction(actionCasted)) {
        const { type, payload, undomundo, ...extra } = actionCasted;
        const originalAction: StateActionUnion<PBT> = {
          ...extra,
          type,
          payload,
        };
        const { isUndo } = undomundo;
        if (isUndo) {
          originalAction.undomundo = {
            isUndo,
          };
        }
        return pipe(
          // should the updates be cleared when the action isSynchronizing?
          uStateWithNewOutput,
          evolve({
            state: reduce(originalAction),
          })
        );
      } else {
        const { type, payload, undomundo } = actionCasted;
        const config = actionConfigs[type];
        if (!config || !undomundo) {
          return pipe(
            // should the updates be cleared when the action is unknown?
            uStateWithNewOutput,
            evolve({
              // we don't know anything about the
              // action, hence 'any'
              state: reduce(actionCasted as any),
            })
          );
        } else {
          const { extra } = undomundo;
          const originalAction: StateActionUnion<PBT> = {
            ...extra,
            type,
            payload,
          };

          const { created, id, skipState, skipHistory } = undomundo;

          const newState = skipState ? state : reducer(state, originalAction);

          if (!skipState && isStateEqual(newState, state)) {
            return uStateWithNewOutput;
          } else {
            const historyItem = {
              type,
              created,
              id,
              payload: isAbsoluteConfig(config)
                ? {
                    undo: undomundo.hasOwnProperty('undoValue')
                      ? undomundo.undoValue
                      : (config.initUndoValue || config.updateHistory)(state)(
                          payload
                        ),
                    redo: payload,
                  }
                : payload,
              ...(extra === undefined ? {} : { extra }),
            } as HistoryItemUnion<PBT>;

            let newUState = pipe(
              uStateWithNewOutput,
              evolve({
                state: () => newState,
                stateUpdates: append<StateUpdate<PBT>>({
                  action: historyItem,
                  direction: 'redo',
                  // skipHistory is passed on so that the update
                  // can be filtered out when syncing to other
                  // clients, or when deriving a version history
                  skipHistory,
                  // skipState is passed on so that the update
                  // can be filtered out for internal actions (non sync)
                  skipState,
                }),
              })
            );

            if (!skipHistory) {
              const historyUpdate: HistoryUpdate<PBT> = {
                type: 'ADD_TO_HISTORY',
                payload: historyItem,
              };

              newUState = pipe(
                newUState,
                evolve({
                  history: reduceHistory(historyUpdate),
                  historyUpdates: append<HistoryUpdate<PBT>>(historyUpdate),
                })
              );
            }

            return newUState;
          }
        }
      }
    }
  };

  const actionCreators = mapRecordWithKey(actionConfigs)<
    UActionCreatorsByType<PBT>
  >(
    type =>
      ((payload, options) => {
        return {
          type,
          payload,
          undomundo: {
            id: v4(),
            created: new Date().toISOString(),
            ...options,
          },
        };
      }) as UActionCreator<string, any>
  );

  const getActionFromStateUpdate = getAction(actionConfigs);

  return {
    uReducer,
    stateReducer: reducer,
    historyReducer,
    actionCreators,
    getActionFromStateUpdate,
  };
};
