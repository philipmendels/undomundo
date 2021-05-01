export type Endomorphism<T> = (t: T) => T;

export type Updater<A, B> = (a: A) => Endomorphism<B>;

export type Action<T = string, P = any> = {
  type: T;
  payload: P;
};

export type Reducer<S, A> = (state: S, action: A) => S;

export type PayloadMapping<PO, PUR> = {
  boxUndoRedo: (undo: PO, redo: PO) => PUR;
  getUndo: (payload: PUR) => PO;
  getRedo: (payload: PUR) => PO;
};

export const isUndoConfigAbsolute = <S = any, PO = any, PUR = any>(
  item: any
): item is UndoConfigAbsolute<S, PO, PUR> =>
  (item as UndoConfigAbsolute<S, PO, PUR>).boxUndoRedo !== undefined;

export const isUndoRedoConfigAbsolute = <S = any, PO = any, PUR = any>(
  item: any
): item is UndoRedoConfigAbsolute<S, PO, PUR> =>
  (item as UndoRedoConfigAbsolute<S, PO, PUR>).boxUndoRedo !== undefined;

export type UndoConfigAbsolute<S, PO, PUR> = {
  updatePayload: Updater<S, PO>;
} & PayloadMapping<PO, PUR>;

export type UndoRedoConfigAbsolute<S, PO, PUR> = {
  updateState: Updater<PO, S>;
} & UndoConfigAbsolute<S, PO, PUR>;

export type StringMap = Record<string, any>;

export type PayloadConfigByType = Record<
  string,
  PayloadConfigRelative | PayloadConfigAbsolute
>;

export type PayloadConfigRelative<PO = any> = {
  original: PO;
};

export type PayloadConfigAbsolute<PO = any, PUR = any> = {
  original: PO;
  undoRedo: PUR;
};

export type PayloadOriginalByType<PBT extends PayloadConfigByType> = {
  [K in keyof PBT]: PBT[K]['original'];
};

export type ActionConvertor<
  PBT extends PayloadConfigByType,
  K extends keyof PBT
> = (
  action: Action<K, PBT[K]['original']>
) => ActionUnion<PayloadOriginalByType<PBT>>;

export const undoConfigAsRelative = <PBT extends PayloadConfigByType>(
  config: any
) =>
  config as {
    undo: ActionConvertor<PBT, keyof PBT>;
  };

export type UndoConfigByType<S, PBT extends PayloadConfigByType> = {
  [K in keyof PBT]: PBT[K] extends PayloadConfigAbsolute
    ? UndoConfigAbsolute<S, PBT[K]['original'], PBT[K]['undoRedo']>
    : {
        undo: ActionConvertor<PBT, K>;
      };
};

export type UndoRedoConfigByType<S, PBT extends PayloadConfigByType> = {
  [K in keyof PBT]: (PBT[K] extends PayloadConfigAbsolute
    ? UndoConfigAbsolute<S, PBT[K]['original'], PBT[K]['undoRedo']>
    : {
        undo: ActionConvertor<PBT, K>;
      }) & {
    updateState: Updater<PBT[K]['original'], S>;
  };
};

export type PayloadUndoRedo<T> = {
  undo: T;
  redo: T;
};

export type PayloadConfigUndoRedo<T> = PayloadConfigAbsolute<
  T,
  PayloadUndoRedo<T>
>;

export type ActionUnion<PBT extends StringMap> = ValueOf<
  {
    [K in keyof PBT]: Action<K, PBT[K]>;
  }
>;

export type UActionUnion<PBT extends StringMap> = {
  [K in keyof PBT]: Action<K, PBT[K]> & { meta?: { skipAddToHist?: boolean } };
}[keyof PBT];

export type UpdatersByType<S, PBT extends StringMap> = {
  [K in keyof PBT]: Updater<PBT[K], S>;
};

export type ActionCreatorsByType<PBT extends StringMap> = {
  [K in keyof PBT]: (payload: PBT[K]) => Action<K, PBT[K]>;
};

export type ValueOf<T> = T[keyof T];

export type HistoryItem<T, PU> = {
  type: T;
  payload: PU;
};

export type HistoryItemUnion<PBT extends PayloadConfigByType> = ValueOf<
  {
    [K in keyof PBT]: HistoryItem<
      K,
      PBT[K] extends PayloadConfigAbsolute
        ? PBT[K]['undoRedo']
        : PBT[K]['original']
    >;
  }
>;
// | HistoryItem<'start', void>;

export type StateWithHistory<S, PBT extends PayloadConfigByType> = {
  state: S;
  history: {
    index: number;
    stack: HistoryItemUnion<PBT>[];
  };
  effects: ActionUnion<PayloadOriginalByType<PBT>>[];
};

export type UActions =
  | {
      type: 'undo';
    }
  | {
      type: 'redo';
    };
