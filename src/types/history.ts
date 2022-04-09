import {
  AbsolutePayload,
  PayloadConfigByType,
  StringMap,
  ValueOf,
} from './main';

export type HistoryItem<T, P, E> = {
  type: T;
  payload: P;
  created: string;
  id: string;
} & (E extends StringMap
  ? {
      extra: E;
    }
  : {
      extra?: never;
    });

export type HistoryAction<T, P, E> = {
  type: T;
  payload: P;
} & (E extends StringMap
  ? {
      extra: E;
    }
  : {
      extra?: never;
    });

export type HistoryPayload<P, R extends boolean | undefined> = R extends true
  ? P
  : AbsolutePayload<P>;

export type HistoryItemUnion<PBT extends PayloadConfigByType> = ValueOf<{
  [K in keyof PBT]: HistoryItem<
    K,
    HistoryPayload<PBT[K]['payload'], PBT[K]['isCustom']>,
    PBT[K]['extra']
  >;
}>;

export type HistoryActionUnion<PBT extends PayloadConfigByType> = ValueOf<{
  [K in keyof PBT]: HistoryAction<
    K,
    HistoryPayload<PBT[K]['payload'], PBT[K]['isCustom']>,
    PBT[K]['extra']
  >;
}>;

export type HistoryPayloadUnion<PBT extends PayloadConfigByType> = ValueOf<{
  [K in keyof PBT]: HistoryPayload<PBT[K]['payload'], PBT[K]['isCustom']>;
}>;

export type AbsolutePayloadUnion<PBT extends PayloadConfigByType> = ValueOf<{
  [K in keyof PBT]: AbsolutePayload<PBT[K]['payload']>;
}>;

export type HistoryPayloadsAsUnion<PBT extends PayloadConfigByType> =
  | AbsolutePayloadUnion<PBT>
  | ValueOf<{ [K in keyof PBT]: PBT[K] }>;

export interface ParentConnection {
  branchId: string;
  globalIndex: number;
}

export type CustomData = Record<string, unknown>;

export interface Branch<
  PBT extends PayloadConfigByType,
  CustomBranchData extends CustomData
> {
  id: string;
  parentConnectionInitial?: ParentConnection;
  parentConnection?: ParentConnection;
  lastGlobalIndex?: number;
  created: string;
  stack: HistoryItemUnion<PBT>[];
  custom: CustomBranchData;
}

type HistoryBase<
  PBT extends PayloadConfigByType,
  CustomBranchData extends CustomData
> = {
  branches: Record<string, Branch<PBT, CustomBranchData>>;
  currentIndex: number;
  stats: {
    branchCounter: number;
    actionCounter: number;
  };
};

export type History<
  PBT extends PayloadConfigByType,
  CBD extends CustomData
> = HistoryBase<PBT, CBD> & {
  currentBranchId: string;
};

export type MaybeEmptyHistory<
  PBT extends PayloadConfigByType,
  CBD extends CustomData
> = HistoryBase<PBT, CBD> & {
  currentBranchId?: string;
};

export type InitBranchData<
  PBT extends PayloadConfigByType,
  CBD extends CustomData
> = (history: MaybeEmptyHistory<PBT, CBD>) => CBD;
