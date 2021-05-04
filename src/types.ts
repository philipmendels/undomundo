export type Endomorphism<T> = (t: T) => T;

export type Updater<A, B> = (a: A) => Endomorphism<B>;

export type ValueOf<T> = T[keyof T];

export type StringMap = Record<string, any>;

export type Action<T = string, P = any> = {
  type: T;
  payload: P;
};

export type PayloadConfigByType = Record<
  string,
  PayloadConfigRelative | PayloadConfigAbsolute
>;

export type ToPayloadConfigByType<PBT extends StringMap> = {
  [K in keyof PBT]: PayloadConfigUndoRedo<PBT[K]>;
};

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

export type ActionUnion<PBT extends StringMap> = ValueOf<
  {
    [K in keyof PBT]: Action<K, PBT[K]>;
  }
>;

export type UActionUnion<PBT extends StringMap> = ValueOf<
  {
    [K in keyof PBT]: Action<K, PBT[K]> & {
      meta?: { skipAddToHist?: boolean };
    };
  }
>;

export type OriginalActionUnion<PBT extends PayloadConfigByType> = ActionUnion<
  PayloadOriginalByType<PBT>
>;

export type OriginalUActionUnion<
  PBT extends PayloadConfigByType
> = UActionUnion<PayloadOriginalByType<PBT>>;

export type AbsoluteValueOf<PBT extends PayloadConfigByType> = ValueOf<
  {
    [K in keyof PBT]: PBT[K] extends PayloadConfigAbsolute ? PBT[K] : never;
  }
>;

// export type RelativeValueOf<PBT extends PayloadConfigByType> = ValueOf<
//   {
//     [K in keyof PBT]: PBT[K] extends PayloadConfigAbsolute ? never : PBT[K];
//   }
// >;

export const isUndoConfigAbsolute = <S, PBT extends PayloadConfigByType>(
  item: any
): item is UndoConfigAbsolute<
  S,
  AbsoluteValueOf<PBT>['original'],
  AbsoluteValueOf<PBT>['undoRedo']
> => (item as UndoConfigAbsolute<any, any, any>).boxUndoRedo !== undefined;

export type PayloadMapping<PO, PUR> = {
  boxUndoRedo: (undo: PO, redo: PO) => PUR;
  getUndo: (payload: PUR) => PO;
  getRedo: (payload: PUR) => PO;
};

export type ActionConvertor<
  PBT extends PayloadConfigByType,
  K extends keyof PBT
> = (action: Action<K, PBT[K]['original']>) => OriginalActionUnion<PBT>;

export type UndoConfigAbsolute<S, PO, PUR> = {
  updatePayload: Updater<S, PO>;
} & PayloadMapping<PO, PUR>;

export type UndoConfigRelative<
  PBT extends PayloadConfigByType,
  K extends keyof PBT
> = {
  undo: ActionConvertor<PBT, K>;
};

type UndoConfig<
  S,
  PBT extends PayloadConfigByType,
  K extends keyof PBT
> = PBT[K] extends PayloadConfigAbsolute
  ? UndoConfigAbsolute<S, PBT[K]['original'], PBT[K]['undoRedo']>
  : UndoConfigRelative<PBT, K>;

export type UndoConfigByType<S, PBT extends PayloadConfigByType> = {
  [K in keyof PBT]: UndoConfig<S, PBT, K>;
};

export type UndoRedoConfigByType<S, PBT extends PayloadConfigByType> = {
  [K in keyof PBT]: UndoConfig<S, PBT, K> & {
    updateState: Updater<PBT[K]['original'], S>;
  };
};

export type DefaultUndoRedoConfigByType<S, PBT extends StringMap> = {
  [K in keyof PBT]: {
    updatePayload: Updater<S, PBT[K]>;
    updateState: Updater<PBT[K], S>;
  };
};

export type UndoRedoConfigAbsolute<S, PO, PUR> = {
  updateState: Updater<PO, S>;
} & UndoConfigAbsolute<S, PO, PUR>;

// export const undoConfigAsAbsolute = <S, PBT extends PayloadConfigByType>(
//   config: any
// ) =>
//   config as UndoConfigAbsolute<
//     S,
//     AbsoluteValueOf<PBT>['original'],
//     AbsoluteValueOf<PBT>['undoRedo']
//   >;

export const undoConfigAsRelative = <PBT extends PayloadConfigByType>(
  config: any
) => config as UndoConfigRelative<PBT, keyof PBT>;

export type PayloadUndoRedo<T> = {
  undo: T;
  redo: T;
};

export type PayloadConfigUndoRedo<T> = PayloadConfigAbsolute<
  T,
  PayloadUndoRedo<T>
>;

export type UpdatersByType<S, PBT extends StringMap> = {
  [K in keyof PBT]: Updater<PBT[K], S>;
};

export type ActionCreatorsByType<PBT extends StringMap> = {
  [K in keyof PBT]: (payload: PBT[K]) => Action<K, PBT[K]>;
};

export type PayloadHandlersByType<S, PBT extends StringMap> = {
  [K in keyof PBT]: (p: PBT[K]) => S;
};

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

// export type HistoryItemUnionRelative<PBT extends PayloadConfigByType> = ValueOf<
//   {
//     [K in keyof PBT]: PBT[K] extends PayloadConfigAbsolute
//       ? never
//       : HistoryItem<K, PBT[K]['original']>;
//   }
// >;

// export type HistoryItemUnionAbsolute<PBT extends PayloadConfigByType> = ValueOf<
//   {
//     [K in keyof PBT]: PBT[K] extends PayloadConfigAbsolute
//       ? HistoryItem<K, PBT[K]['undoRedo']>
//       : never;
//   }
// >;

export type StateWithHistory<S, PBT extends PayloadConfigByType> = {
  state: S;
  history: {
    index: number;
    stack: HistoryItemUnion<PBT>[];
  };
  effects: OriginalActionUnion<PBT>[];
};

export type UActions =
  | {
      type: 'undo';
    }
  | {
      type: 'redo';
    };

export type Reducer<S, A> = (state: S, action: A) => S;

export type ReducerOf<S, PBT extends PayloadConfigByType> = Reducer<
  S,
  OriginalActionUnion<PBT>
>;

export type UReducerOf<S, PBT extends PayloadConfigByType> = Reducer<
  StateWithHistory<S, PBT>,
  UActions | OriginalUActionUnion<PBT>
>;
