import { History } from './types/history';
import { PayloadConfigByType, UndoRedoActionUnion } from './types/main';
import { v4 } from 'uuid';

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

export const getCurrentBranch = <PBT extends PayloadConfigByType>(
  prev: History<PBT>
) => prev.branches[prev.currentBranchId];

export const getCurrentIndex = <PBT extends PayloadConfigByType>(
  prev: History<PBT>
) => prev.currentPosition.globalIndex;

export const getCurrentBranchActions = <PBT extends PayloadConfigByType>(
  history: History<PBT>
): UndoRedoActionUnion<PBT>[] =>
  getCurrentBranch(history).stack.map(({ type, payload }) => ({
    type,
    payload,
  }));
