import { PayloadConfigByType, ValueOf } from './main';

export type HistoryItem<T, PUR> = {
  type: T;
  payload: PUR;
  created: Date;
  id: string;
};

export type HistoryItemUnion<PBT extends PayloadConfigByType> = ValueOf<
  {
    [K in keyof PBT]: HistoryItem<K, PBT[K]['undoRedo']>;
  }
>;

export interface PositionOnBranch {
  globalIndex: number;
  actionId: string;
}

export interface ParentConnection {
  branchId: string;
  position: PositionOnBranch;
}

export interface Branch<PBT extends PayloadConfigByType> {
  id: string;
  number: number;
  parent?: {
    branchId: string;
    position: PositionOnBranch;
  };
  parentOriginal?: {
    branchId: string;
    position: PositionOnBranch;
  };
  lastPosition?: PositionOnBranch;
  created: Date;
  stack: HistoryItemUnion<PBT>[];
}

export interface BranchConnection<PBT extends PayloadConfigByType> {
  position: PositionOnBranch;
  branches: Branch<PBT>[];
}

export interface History<PBT extends PayloadConfigByType> {
  branches: Record<string, Branch<PBT>>;
  currentBranchId: string;
  currentPosition: PositionOnBranch;
}
