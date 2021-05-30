import { Branch, History, HistoryItemUnion } from './types/history';
import {
  Endomorphism,
  OriginalActionUnion,
  PartialActionConfigByType,
  PayloadConfigByType,
  UndoRedoActionUnion,
  UOptions,
  Updater,
  UState,
} from './types/main';
import { v4 } from 'uuid';
import {
  add1,
  evolve,
  ifElse,
  when,
  merge,
  subtract,
  whenIsDefined,
  slice,
  modifyArrayAt,
  subtract1,
  Evolver,
  repeatApply,
  append,
} from './util';
import { flow, identity, pipe } from 'fp-ts/function';
import { filter, map as mapR } from 'fp-ts/Record';

let branchCounter = 0;

export const createInitialHistory = <
  PBT extends PayloadConfigByType
>(): History<PBT> => {
  const initialBranchId = v4();
  return {
    currentIndex: -1,
    branches: {
      [initialBranchId]: {
        id: initialBranchId,
        created: new Date(),
        stack: [],
        name: `branch ${branchCounter++}`,
      },
    },
    currentBranchId: initialBranchId,
  };
};

const wrap = <PBT extends PayloadConfigByType>(
  f: (hist: History<PBT>) => Endomorphism<History<PBT>>
) => (hist: History<PBT>) => f(hist)(hist);

export const getCurrentBranch = <PBT extends PayloadConfigByType>(
  prev: History<PBT>
) => prev.branches[prev.currentBranchId];

export const getCurrentIndex = <PBT extends PayloadConfigByType>(
  prev: History<PBT>
) => prev.currentIndex;

// for testing:
export const getCurrentBranchActions = <PBT extends PayloadConfigByType>(
  history: History<PBT>
) => getBranchActions(getCurrentBranch(history));

export const getBranchActions = <PBT extends PayloadConfigByType>(
  branch: Branch<PBT>
): UndoRedoActionUnion<PBT>[] =>
  branch.stack.map(({ type, payload }) => ({
    type,
    payload,
  }));

type CollectedIds = {
  orphanIds: string[];
  otherIds: string[];
};

const getParents = <PBT extends PayloadConfigByType>(
  hist: History<PBT>,
  branch: Branch<PBT>,
  branchList: Branch<PBT>[],
  allIds: string[]
): Branch<PBT>[] =>
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

const clearOrphanBranches = <PBT extends PayloadConfigByType>(
  modus: 'HEAD' | 'TAIL'
) =>
  wrap<PBT>(hist => {
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

const clearFuture = <PBT extends PayloadConfigByType>() =>
  wrap<PBT>(hist =>
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

export const addHistoryItem = <PBT extends PayloadConfigByType>(
  action: HistoryItemUnion<PBT>,
  options: Required<UOptions>
): Endomorphism<History<PBT>> =>
  flow(
    ifElse(
      isAtHead,
      addActionToCurrentBranch(action),
      ifElse(
        () => options.useBranchingHistory,
        addActionToNewBranch(action),
        flow(clearFuture(), addActionToCurrentBranch(action))
      )
    ),
    shrinkCurrentBranch(options.maxHistoryLength)
  );

const shrinkCurrentBranch = <PBT extends PayloadConfigByType>(
  maxHistoryLength: number
) =>
  wrap<PBT>(hist => {
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

export const isAtHead = <PBT extends PayloadConfigByType>(
  history: History<PBT>
) => getCurrentIndex(history) === getCurrentBranch(history).stack.length - 1;

export const addActionToNewBranch = <PBT extends PayloadConfigByType>(
  action: HistoryItemUnion<PBT>
) =>
  wrap<PBT>(hist => {
    const currentIndex = getCurrentIndex(hist);
    const newBranchId = v4();

    const newBranch: Branch<PBT> = {
      created: new Date(),
      id: newBranchId,
      name: `branch ${branchCounter++}`,
      stack: getCurrentBranch(hist)
        .stack.slice(0, currentIndex + 1)
        .concat(action),
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
    });
  });

export const reparentBranches = <PBT extends PayloadConfigByType>(
  newBranchId: string,
  branchId: string,
  index: number
): Endomorphism<Record<string, Branch<PBT>>> =>
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

export const addActionToCurrentBranch = <PBT extends PayloadConfigByType>(
  action: HistoryItemUnion<PBT>
) =>
  wrap<PBT>(hist =>
    evolve({
      currentIndex: add1,
      branches: evolve({
        [hist.currentBranchId]: evolve({
          stack: append(action),
        }),
      }),
    })
  );

export const undo = <S, PBT extends PayloadConfigByType>(
  reduce: Updater<OriginalActionUnion<PBT>, S>,
  actionConfigs: PartialActionConfigByType<S, PBT>
): Endomorphism<UState<S, PBT>> => uState => {
  const { state, history } = uState;
  const currentIndex = getCurrentIndex(history);
  const currentBranch = getCurrentBranch(history);
  const currentItem = currentBranch.stack[currentIndex];
  const { type, payload } = currentItem;
  const config = actionConfigs[type];
  const newAction = config.makeActionForUndo({ type, payload });

  return pipe(
    uState,
    evolve({
      history: evolve({
        currentIndex: subtract1,
        branches: config.updatePayloadOnUndo
          ? evolve({
              [currentBranch.id]: evolve({
                stack: modifyArrayAt(
                  currentIndex,
                  evolve({
                    payload: config.updatePayloadOnUndo(state),
                  } as Evolver<HistoryItemUnion<PBT>>)
                ),
              }),
            })
          : identity,
      }),
      state: reduce({
        ...newAction,
        undoMundo: { isUndo: true },
      }),
      effects: append({
        direction: 'undo',
        action: newAction,
      }),
    })
  );
};

export const redo = <S, PBT extends PayloadConfigByType>(
  reduce: Updater<OriginalActionUnion<PBT>, S>,
  actionConfigs: PartialActionConfigByType<S, PBT>
): Endomorphism<UState<S, PBT>> => uState => {
  const { state, history } = uState;
  const currentIndex = getCurrentIndex(history);
  const currentBranch = getCurrentBranch(history);

  const currentItem = currentBranch.stack[currentIndex + 1];
  const { type, payload } = currentItem;
  const config = actionConfigs[type];
  const newAction = config.makeActionForRedo({ type, payload });

  return pipe(
    uState,
    evolve({
      history: evolve({
        currentIndex: add1,
        branches: config.updatePayloadOnRedo
          ? evolve({
              [currentBranch.id]: evolve({
                stack: modifyArrayAt(
                  currentIndex + 1,
                  evolve({
                    payload: config.updatePayloadOnRedo(state),
                  } as Evolver<HistoryItemUnion<PBT>>)
                ),
              }),
            })
          : identity,
      }),
      state: reduce(newAction),
      effects: append({
        direction: 'redo',
        action: newAction,
      }),
    })
  );
};

export const timeTravelCurrentBranch = <S, PBT extends PayloadConfigByType>(
  reduce: Updater<OriginalActionUnion<PBT>, S>,
  actionConfigs: PartialActionConfigByType<S, PBT>,
  indexOnBranch: number
): Endomorphism<UState<S, PBT>> => uState => {
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
      undo(reduce, actionConfigs)
    )(uState);
  } else {
    return repeatApply(
      indexOnBranch - currentIndex,
      redo(reduce, actionConfigs)
    )(uState);
  }
};

export const getPathFromCommonAncestor = <PBT extends PayloadConfigByType>(
  history: History<PBT>,
  branchId: string,
  path: Branch<PBT>[] = []
): Branch<PBT>[] => {
  const branch = history.branches[branchId];
  if (branch.parentConnection) {
    const newPath = [branch, ...path];
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

export const getBranchSwitchProps = <PBT extends PayloadConfigByType>(
  history: History<PBT>,
  branchId: string
) => {
  const path = getPathFromCommonAncestor(history, branchId);
  return {
    path,
    parentIndex: path[path.length - 1].parentConnection!.globalIndex,
    caIndex: path[0].parentConnection!.globalIndex,
  };
};

export const updatePath = <PBT extends PayloadConfigByType>(path: string[]) => (
  prevHistory: History<PBT>
) =>
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

export const storeLastGlobalIndex = <PBT extends PayloadConfigByType>() =>
  wrap<PBT>(hist =>
    evolve({
      branches: evolve({
        [hist.currentBranchId]: merge({
          lastGlobalIndex: getCurrentIndex(hist),
        }),
      }),
    })
  );
