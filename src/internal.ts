import {
  AbsolutePayloadUnion,
  Branch,
  CustomData,
  History,
  HistoryActionUnion,
  HistoryItemUnion,
  HistoryPayload,
  HistoryPayloadsAsUnion,
  HistoryPayloadUnion,
  InitBranchData,
} from './types/history';
import {
  Endomorphism,
  PartialActionConfigByType,
  PayloadConfigByType,
  Updater,
  UState,
  HistoryUpdate,
  HistoryOptions,
  StateActionUnion,
  RelativeActionConfig,
  SyncActionUnion,
  UActionUnion,
  AbsolutePartialActionConfigUnion,
  PartialActionConfigsAsUnion,
  StateUpdate,
  ActionConfigByType,
} from './types/main';
import {
  add1,
  evolve,
  ifElse,
  when,
  merge,
  subtract,
  whenIsDefined,
  slice,
  repeatApply,
  append,
} from './util';
import { flow, pipe } from 'fp-ts/function';
import { filter, map as mapR } from 'fp-ts/Record';

const wrap = <PBT extends PayloadConfigByType, CD extends CustomData>(
  f: (hist: History<PBT, CD>) => Endomorphism<History<PBT, CD>>
) => (hist: History<PBT, CD>) => f(hist)(hist);

export const getCurrentBranch = <
  PBT extends PayloadConfigByType,
  CD extends CustomData
>(
  prev: History<PBT, CD>
) => prev.branches[prev.currentBranchId];

export const getCurrentIndex = <
  PBT extends PayloadConfigByType,
  CD extends CustomData
>(
  prev: History<PBT, CD>
) => prev.currentIndex;

// for testing:
export const getCurrentBranchActions = <
  PBT extends PayloadConfigByType,
  CD extends CustomData
>(
  history: History<PBT, CD>
) => getBranchActions(getCurrentBranch(history));

export const getBranchActions = <
  PBT extends PayloadConfigByType,
  CD extends CustomData
>(
  branch: Branch<PBT, CD>
): HistoryActionUnion<PBT>[] =>
  branch.stack.map(
    ({ type, payload, extra }) =>
      ({
        type,
        payload,
        ...(extra === undefined ? {} : { extra }),
      } as HistoryActionUnion<PBT>)
  );

type CollectedIds = {
  orphanIds: string[];
  otherIds: string[];
};

const getParents = <PBT extends PayloadConfigByType, CD extends CustomData>(
  hist: History<PBT, CD>,
  branch: Branch<PBT, CD>,
  branchList: Branch<PBT, CD>[],
  allIds: string[]
): Branch<PBT, CD>[] =>
  allIds.includes(branch.id)
    ? branchList
    : branch.parentConnection
    ? getParents(
        hist,
        hist.branches[branch.parentConnection.branchId],
        [...branchList, branch],
        allIds
      )
    : [...branchList, branch];

const clearOrphanBranches = <
  PBT extends PayloadConfigByType,
  CD extends CustomData
>(
  modus: 'HEAD' | 'TAIL'
) =>
  wrap<PBT, CD>(hist => {
    const currentBranch = getCurrentBranch(hist);

    const { orphanIds } = Object.entries(hist.branches).reduce<CollectedIds>(
      ({ orphanIds, otherIds }, [_, b]) => {
        const branchList = getParents(hist, b, [], orphanIds.concat(otherIds));
        if (branchList.length) {
          const parent = branchList[branchList.length - 1].parentConnection!;
          const idx = parent.globalIndex;
          const ids = branchList.map(b => b.id);
          // -1 is still a valid index
          if (
            orphanIds.includes(parent.branchId) ||
            (parent.branchId === hist.currentBranchId &&
              ((modus === 'HEAD' && idx < -1) ||
                (modus === 'TAIL' && idx > currentBranch.stack.length - 1)))
          ) {
            orphanIds.push(...ids);
          } else {
            otherIds.push(...ids);
          }
        }
        return { orphanIds, otherIds };
      },
      {
        orphanIds: [],
        otherIds: [currentBranch.id],
      }
    );

    return evolve({
      branches: filter(b => !orphanIds.includes(b.id)),
    });
  });

const clearFuture = <
  PBT extends PayloadConfigByType,
  CD extends CustomData
>() =>
  wrap<PBT, CD>(hist =>
    flow(
      evolve({
        branches: evolve({
          [hist.currentBranchId]: evolve({
            stack: slice(0, getCurrentIndex(hist) + 1),
          }),
        }),
      }),
      // This will be rare in practice, because the future
      // will only be cleared when the useBranchingHistory
      // options is false, so there will be no other branches
      // to clear at all. However, it may be necessary when
      // the useBranchingHistory is changed, at runtime, or
      // at application start with a persisted undo-history.
      clearOrphanBranches('TAIL')
    )
  );

export const addHistoryItem = <
  PBT extends PayloadConfigByType,
  CD extends CustomData
>(
  action: HistoryItemUnion<PBT>,
  options: Required<HistoryOptions>,
  initBranchData: InitBranchData<PBT, CD>
): Endomorphism<History<PBT, CD>> =>
  flow(
    ifElse(
      isAtHead,
      addActionToCurrentBranch(action),
      ifElse(
        () => options.useBranchingHistory,
        addActionToNewBranch(action, initBranchData),
        flow(clearFuture(), addActionToCurrentBranch(action))
      )
    ),
    evolve({ stats: evolve({ actionCounter: add1 }) }),
    shrinkCurrentBranch(options.maxHistoryLength)
  );

const shrinkCurrentBranch = <
  PBT extends PayloadConfigByType,
  CD extends CustomData
>(
  maxHistoryLength: number
) =>
  wrap<PBT, CD>(hist => {
    const diff = getCurrentBranch(hist).stack.length - maxHistoryLength;
    const correctIndex = subtract(diff);
    return when(
      () => diff > 0,
      flow(
        evolve({
          branches: flow(
            evolve({
              [hist.currentBranchId]: evolve({
                stack: slice(diff),
              }),
            }),
            mapR(
              evolve({
                parentConnection: whenIsDefined(
                  evolve({
                    globalIndex: correctIndex,
                  })
                ),
                parentConnectionInitial: whenIsDefined(
                  evolve({
                    globalIndex: correctIndex,
                  })
                ),
                lastGlobalIndex: whenIsDefined(correctIndex),
              })
            )
          ),
          currentIndex: correctIndex,
        }),
        clearOrphanBranches('HEAD')
      )
    );
  });

export const isAtHead = <
  PBT extends PayloadConfigByType,
  CD extends CustomData
>(
  history: History<PBT, CD>
) => getCurrentIndex(history) === getCurrentBranch(history).stack.length - 1;

export const addActionToNewBranch = <
  PBT extends PayloadConfigByType,
  CD extends CustomData
>(
  action: HistoryItemUnion<PBT>,
  initBranchData: InitBranchData<PBT, CD>
) =>
  wrap<PBT, CD>(hist => {
    const currentIndex = getCurrentIndex(hist);
    const newBranchId = action.id;

    const newBranch: Branch<PBT, CD> = {
      created: action.created,
      id: newBranchId,
      // name: `branch ${branchCounter++}`,
      stack: getCurrentBranch(hist)
        .stack.slice(0, currentIndex + 1)
        .concat(action),
      parentConnectionInitial: {
        branchId: hist.currentBranchId,
        globalIndex: hist.currentIndex,
      },
      custom: initBranchData(hist),
    };

    return evolve({
      currentIndex: add1,
      currentBranchId: () => newBranchId,
      branches: flow(
        reparentBranches(newBranchId, hist.currentBranchId, currentIndex),
        merge({ [newBranchId]: newBranch }),
        evolve({
          [hist.currentBranchId]: evolve({
            lastGlobalIndex: () => hist.currentIndex,
            stack: slice(currentIndex + 1),
            parentConnection: () => ({
              branchId: newBranchId,
              globalIndex: hist.currentIndex,
            }),
          }),
        })
      ),
      stats: evolve({ branchCounter: add1 }),
    });
  });

export const reparentBranches = <
  PBT extends PayloadConfigByType,
  CD extends CustomData
>(
  newBranchId: string,
  branchId: string,
  index: number
): Endomorphism<Record<string, Branch<PBT, CD>>> =>
  mapR(
    when(
      b =>
        b.parentConnection?.branchId === branchId &&
        b.parentConnection.globalIndex <= index,
      evolve({
        parentConnection: merge({ branchId: newBranchId }),
      })
    )
  );

export const addActionToCurrentBranch = <
  PBT extends PayloadConfigByType,
  CD extends CustomData
>(
  action: HistoryItemUnion<PBT>
) =>
  wrap<PBT, CD>(hist =>
    evolve({
      currentIndex: add1,
      branches: evolve({
        [hist.currentBranchId]: evolve({
          stack: append(action),
        }),
      }),
    })
  );

export const getUndoValue = (payload: HistoryPayload<any, any>) => {
  return isAbsolutePayload(payload) ? payload.undo : payload;
};

export const getRedoValue = (payload: HistoryPayload<any, any>) => {
  return isAbsolutePayload(payload) ? payload.redo : payload;
};

export const isAbsolutePayload = <PBT extends PayloadConfigByType>(
  payload: HistoryPayloadsAsUnion<PBT>
): payload is AbsolutePayloadUnion<PBT> =>
  typeof payload === 'object' &&
  (payload as object)?.hasOwnProperty('undo') &&
  (payload as object)?.hasOwnProperty('redo');

export const isAbsoluteConfig = <S, PBT extends PayloadConfigByType>(
  config: PartialActionConfigsAsUnion<S, PBT>
): config is AbsolutePartialActionConfigUnion<S, PBT> =>
  !config.hasOwnProperty('makeActionForUndo');

export const isSyncAction = <PBT extends PayloadConfigByType>(
  action: SyncActionUnion<PBT> | UActionUnion<PBT>
): action is SyncActionUnion<PBT> =>
  (action as SyncActionUnion<PBT>).undomundo?.isSynchronizing;

export const undo = <S, PBT extends PayloadConfigByType, CD extends CustomData>(
  reduce: Updater<StateActionUnion<PBT>, S>,
  reduceHistory: Updater<HistoryUpdate<PBT>, History<PBT, CD>>,
  actionConfigs: PartialActionConfigByType<S, PBT>,
  disableUpdateHistory: boolean
): Endomorphism<UState<S, PBT, CD>> => uState => {
  const { state, history } = uState;
  const currentIndex = getCurrentIndex(history);
  const currentBranch = getCurrentBranch(history);
  const historyItem = currentBranch.stack[currentIndex];
  const { type, extra, payload } = historyItem;

  const historyAction = {
    type,
    payload,
    ...(extra === undefined ? {} : { extra }),
  } as HistoryActionUnion<PBT>;

  const config = actionConfigs[type] as PartialActionConfigsAsUnion<S, PBT>;

  let newPayload: HistoryPayloadsAsUnion<PBT> | undefined;

  let newAction = getUndoAction(actionConfigs)(historyAction);

  if (isAbsoluteConfig(config)) {
    const { updateHistory } = config;
    if (isAbsolutePayload(payload)) {
      if (!disableUpdateHistory) {
        newPayload = {
          undo: payload.undo,
          redo: updateHistory(state)(payload.redo),
        };
      }
    } else {
      throw new Error('payload does not match config');
    }
  } else {
    const { updateHistory } = config;
    if (!disableUpdateHistory) {
      newPayload = updateHistory?.(state)(payload);
    }
  }

  const historyUpdate: HistoryUpdate<PBT> = {
    type: 'UNDO_WITH_UPDATE',
    payload: newPayload as HistoryPayloadUnion<PBT>,
  };

  return pipe(
    uState,
    evolve({
      history: reduceHistory(historyUpdate),
      state: reduce(newAction),
      stateUpdates: append<StateUpdate<PBT>>({
        action: historyAction,
        direction: 'undo',
      }),
      historyUpdates: append<HistoryUpdate<PBT>>(historyUpdate),
    })
  );
};

// TODO: re-use code across the undo/redo functions in ./internal
export const getUndoAction = <S, PBT extends PayloadConfigByType>(
  actionConfigs: PartialActionConfigByType<S, PBT> | ActionConfigByType<S, PBT>
) => (action: HistoryActionUnion<PBT>): StateActionUnion<PBT> => {
  const { type, extra } = action;
  const config = actionConfigs[type] as PartialActionConfigsAsUnion<S, PBT>;
  const payload = action.payload as HistoryPayloadsAsUnion<PBT>;
  let newAction: StateActionUnion<PBT>;

  if (isAbsoluteConfig(config)) {
    if (isAbsolutePayload(payload)) {
      newAction = {
        ...extra,
        type,
        payload: payload.undo,
      };
    } else {
      throw new Error('payload does not match config');
    }
  } else {
    newAction = config.makeActionForUndo({
      ...extra,
      type,
      payload,
    });
    if ((config as RelativeActionConfig<any, any, any>).updateStateOnUndo) {
      // we cannot simply add 'isUndo' to the 'meta' field,
      // because the original 'meta' field may be a primitive
      // value.
      newAction = { ...newAction, undomundo: { isUndo: true } };
    }
  }

  return newAction;
};

export const redo = <S, PBT extends PayloadConfigByType, CD extends CustomData>(
  reduce: Updater<StateActionUnion<PBT>, S>,
  reduceHistory: Updater<HistoryUpdate<PBT>, History<PBT, CD>>,
  actionConfigs: PartialActionConfigByType<S, PBT>,
  disableUpdateHistory: boolean
): Endomorphism<UState<S, PBT, CD>> => uState => {
  const { state, history } = uState;
  const currentIndex = getCurrentIndex(history);
  const currentBranch = getCurrentBranch(history);

  const historyItem = currentBranch.stack[currentIndex + 1];
  const { type, payload, extra } = historyItem;

  const historyAction = {
    type,
    payload,
    ...(extra === undefined ? {} : { extra }),
  } as HistoryActionUnion<PBT>;

  const config = actionConfigs[type] as PartialActionConfigsAsUnion<S, PBT>;

  let newPayload: HistoryPayloadsAsUnion<PBT> | undefined;

  const newAction = getRedoAction(actionConfigs)(historyAction);

  if (isAbsoluteConfig(config)) {
    if (isAbsolutePayload(payload)) {
      const { updateHistory } = config;

      if (!disableUpdateHistory) {
        newPayload = {
          undo: updateHistory(state)(payload.undo),
          redo: payload.redo,
        };
      }
    } else {
      throw new Error('payload does not match config');
    }
  } else {
    const { updateHistory } = config;
    if (!disableUpdateHistory) {
      newPayload = updateHistory?.(state)(payload);
    }
  }

  const historyUpdate: HistoryUpdate<PBT> = {
    type: 'REDO_WITH_UPDATE',
    payload: newPayload as HistoryPayloadUnion<PBT>,
  };

  return pipe(
    uState,
    evolve({
      history: reduceHistory(historyUpdate),
      state: reduce(newAction),
      stateUpdates: append<StateUpdate<PBT>>({
        action: historyAction,
        direction: 'redo',
      }),
      historyUpdates: append<HistoryUpdate<PBT>>(historyUpdate),
    })
  );
};

export const getRedoAction = <S, PBT extends PayloadConfigByType>(
  // configs are not really needed here, only for the
  // additional type guard
  actionConfigs: PartialActionConfigByType<S, PBT> | ActionConfigByType<S, PBT>
) => (action: HistoryActionUnion<PBT>): StateActionUnion<PBT> => {
  const { type, extra } = action;

  const payload = action.payload as HistoryPayloadsAsUnion<PBT>;
  const config = actionConfigs[type] as PartialActionConfigsAsUnion<S, PBT>;

  let newAction: StateActionUnion<PBT>;

  if (isAbsoluteConfig(config)) {
    if (isAbsolutePayload(payload)) {
      newAction = {
        ...extra,
        type,
        payload: payload.redo,
      };
    } else {
      throw new Error('payload does not match config');
    }
  } else {
    newAction = {
      ...extra,
      type,
      payload,
    };
  }

  return newAction;
};

export const timeTravelCurrentBranch = <
  S,
  PBT extends PayloadConfigByType,
  CD extends CustomData
>(
  reduce: Updater<StateActionUnion<PBT>, S>,
  reduceHistory: Updater<HistoryUpdate<PBT>, History<PBT, CD>>,
  actionConfigs: PartialActionConfigByType<S, PBT>,
  disableUpdateHistory: boolean,
  indexOnBranch: number
): Endomorphism<UState<S, PBT, CD>> => uState => {
  const { history } = uState;
  const currentIndex = getCurrentIndex(history);
  const currentBranch = getCurrentBranch(history);
  if (indexOnBranch === currentIndex) {
    return uState;
  } else if (
    indexOnBranch > currentBranch.stack.length - 1 ||
    indexOnBranch < -1
  ) {
    throw new Error(`Invalid index ${indexOnBranch}`);
  } else if (indexOnBranch < currentIndex) {
    return repeatApply(
      currentIndex - indexOnBranch,
      undo(reduce, reduceHistory, actionConfigs, disableUpdateHistory)
    )(uState);
  } else {
    return repeatApply(
      indexOnBranch - currentIndex,
      redo(reduce, reduceHistory, actionConfigs, disableUpdateHistory)
    )(uState);
  }
};

/**
 * returns [currentBranch, ...possibleBranches, caBranch]
 */
export const getPathFromCommonAncestor = <
  PBT extends PayloadConfigByType,
  CD extends CustomData
>(
  history: History<PBT, CD>,
  branchId: string,
  pathToTarget: Branch<PBT, CD>[] = []
): Branch<PBT, CD>[] => {
  const branch = history.branches[branchId];
  if (branch.parentConnection) {
    const newPath = [branch, ...pathToTarget];
    if (branch.parentConnection.branchId === history.currentBranchId) {
      return newPath;
    } else {
      return getPathFromCommonAncestor(
        history,
        branch.parentConnection.branchId,
        newPath
      );
    }
  }
  throw new Error('Attempt to switch to a branch that is already current.');
};

export const getBranchSwitchProps = <
  PBT extends PayloadConfigByType,
  CD extends CustomData
>(
  history: History<PBT, CD>,
  targetBranchId: string
) => {
  const path = getPathFromCommonAncestor(history, targetBranchId);
  return {
    pathToTarget: path.map(b => b.id),
    parentIndex: path[path.length - 1].parentConnection!.globalIndex,
    caIndex: path[0].parentConnection!.globalIndex,
  };
};

export const updatePath = <
  PBT extends PayloadConfigByType,
  CD extends CustomData
>(
  path: string[]
) => (prevHistory: History<PBT, CD>) =>
  path.reduce((newHist, pathBranchId) => {
    const branch = newHist.branches[newHist.currentBranchId];
    const stack = branch.stack;
    const pathBranch = newHist.branches[pathBranchId];
    const parent = pathBranch.parentConnection!;

    const newBranchId = pathBranch.id;
    const index = parent.globalIndex;

    return pipe(
      newHist,
      evolve({
        currentBranchId: () => newBranchId,
        branches: flow(
          reparentBranches(newBranchId, parent.branchId, index),
          evolve({
            [branch.id]: merge({
              stack: stack.slice(index + 1),
              parentConnection: {
                branchId: newBranchId,
                globalIndex: parent.globalIndex,
              },
            }),
            [newBranchId]: merge({
              stack: stack.slice(0, index + 1).concat(pathBranch.stack),
              parentConnection: undefined,
            }),
          })
        ),
      })
    );
  }, prevHistory);

export const storeLastGlobalIndex = <
  PBT extends PayloadConfigByType,
  CD extends CustomData
>() =>
  wrap<PBT, CD>(hist =>
    evolve({
      branches: evolve({
        [hist.currentBranchId]: merge({
          lastGlobalIndex: getCurrentIndex(hist),
        }),
      }),
    })
  );
