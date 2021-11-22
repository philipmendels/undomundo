import { PayloadConfigByType, ValueOf } from './main';

export type HistoryItem<T, PUR, E> = {
  type: T;
  payload: PUR;
  created: Date;
  id: string;
  extra?: E;
};

export type HistoryItemUnion<PBT extends PayloadConfigByType> = ValueOf<
  {
    [K in keyof PBT]: HistoryItem<K, PBT[K]['history'], PBT[K]['extra']>;
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
