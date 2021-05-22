import { Branch, History, HistoryItemUnion } from './types/history';
import {
  Endomorphism,
  PayloadConfigByType,
  UndoRedoActionUnion,
  UOptions,
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
} from './util';
import { append } from 'fp-ts/Array';
import { flow } from 'fp-ts/function';
import { filter, map as mapR } from 'fp-ts/Record';

export const createInitialHistory = <
  PBT extends PayloadConfigByType
>(): History<PBT> => {
  const initialBranchId = v4();
  return {
    currentPosition: {
      globalIndex: -1,
      actionId: 'start',
    },
    branches: {
      [initialBranchId]: {
        id: initialBranchId,
        created: new Date(),
        stack: [],
        number: 1,
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
) => prev.currentPosition.globalIndex;

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
    : branch.parent
    ? getParents(
        hist,
        hist.branches[branch.parent.branchId],
        branchList,
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
          const parent = branchList[branchList.length - 1].parent!;
          const idx = parent.position.globalIndex;
          const ids = branchList.map(b => b.id);
          if (
            orphanIds.includes(parent.branchId) ||
            (parent.branchId === hist.currentBranchId &&
              ((modus === 'HEAD' && idx < 0) ||
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
                parent: whenIsDefined(
                  evolve({
                    position: evolve({ globalIndex: subtract(diff) }),
                  })
                ),
                lastPosition: whenIsDefined(
                  evolve({ globalIndex: subtract(diff) })
                ),
              })
            )
          ),
          currentPosition: evolve({ globalIndex: subtract(diff) }),
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
): Endomorphism<History<PBT>> =>
  wrap(hist => {
    const currentIndex = getCurrentIndex(hist);
    const newBranchId = v4();

    const newBranch: Branch<PBT> = {
      created: new Date(),
      id: newBranchId,
      number: Math.max(...Object.values(hist.branches).map(b => b.number)) + 1,
      stack: getCurrentBranch(hist)
        .stack.slice(0, currentIndex + 1)
        .concat(action),
    };

    return evolve({
      currentPosition: evolve({
        actionId: () => action.id,
        globalIndex: add1,
      }),
      currentBranchId: () => newBranchId,
      branches: flow(
        reparentBranches(newBranchId, hist.currentBranchId, currentIndex),
        merge({ [newBranchId]: newBranch }),
        evolve({
          [hist.currentBranchId]: evolve({
            lastPosition: () => hist.currentPosition,
            stack: slice(currentIndex + 1),
            parent: () => ({
              branchId: newBranchId,
              position: hist.currentPosition,
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
        b.parent?.branchId === branchId &&
        b.parent.position.globalIndex <= index,
      evolve({
        parent: merge({ branchId: newBranchId }),
      })
    )
  );

export const addActionToCurrentBranch = <PBT extends PayloadConfigByType>(
  action: HistoryItemUnion<PBT>
): Endomorphism<History<PBT>> =>
  wrap(hist =>
    evolve({
      currentPosition: evolve({
        globalIndex: add1,
        actionId: () => action.id,
      }),
      branches: evolve({
        [hist.currentBranchId]: evolve({
          stack: append(action),
        }),
      }),
    })
  );
