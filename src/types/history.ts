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

export interface ParentConnection {
  branchId: string;
  globalIndex: number;
}

export type CustomData = Record<string, any>;

export interface Branch<
  PBT extends PayloadConfigByType,
  CustomBranchData extends CustomData
> {
  id: string;
  parentConnectionInitial?: ParentConnection;
  parentConnection?: ParentConnection;
  lastGlobalIndex?: number;
  created: Date;
  stack: HistoryItemUnion<PBT>[];
  custom: CustomBranchData;
}

export interface History<
  PBT extends PayloadConfigByType,
  CustomBranchData extends CustomData
> {
  branches: Record<string, Branch<PBT, CustomBranchData>>;
  currentBranchId: string;
  currentIndex: number;
  stats: {
    branchCounter: number;
    actionCounter: number;
  };
}
