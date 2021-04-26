export type Endomorphism<T> = (t:T) => T;

export type Updater<A, B> = (a: A) => Endomorphism<B>;

export type Action<T = string, P = any> = {
  type: T;
  payload: P;
}

export type Reducer<S, A> = (state: S, action: A) => S;

export type PayloadMap<V, P> = {
  init: (undo: V, redo: V) => P;
  getUndo: (payload: P) => V,
  getDrdo: (payload: P) => V,
};

export type UndoMap<S, V, P> = {
  getValue: Updater<S, V>;
  payloadMap: PayloadMap<V, P>;
}

export type PayloadValue<P, V> = {
  payload: P;
  value: V;
}

export type StringMap = Record<string, any>;

export type PayloadByType = {
  [x: string]: PayloadValue<any, any>;
};

export type ValueByType<PBT extends PayloadByType> = {
  [K in keyof PBT]: PBT[K]["value"]
}

export type ActionUnion<PBT extends StringMap> = {
  [K in keyof PBT]: Action<K, PBT[K]>
}[keyof PBT];

export type UActionUnion<PBT extends StringMap> = {
  [K in keyof PBT]: Action<K, PBT[K]> & { meta?: { skipAddToHist?: boolean } }
}[keyof PBT];

export type UndoMapByType<S, PBT extends PayloadByType> = {
  [K in keyof PBT]: UndoMap<S, PBT[K]['value'], PBT[K]['payload']>;
}

export type PayloadUndoRedo<T> = {
  undo: T;
  redo: T;
}

export type PayloadValueUndoRedo<T> = PayloadValue<PayloadUndoRedo<T>, T>;

export type PayloadValueDelta<T> = PayloadValue<T, T>;

// remove index signature
export type RI<T> = {
  // eslint-disable-next-line prettier/prettier
  [P in keyof T as string extends P ? never : number extends P ? never : P]: T[P]
};

export type UpdatersByType<S, PBT extends StringMap> = {
  [K in keyof PBT]: Updater<PBT[K], S>;
};

export type ActionCreatorsByType<PBT extends StringMap> = {
  [K in keyof PBT]: (payload: PBT[K]) => Action<K, PBT[K]>
}

export type ValueOf<T> = T[keyof T];


export type HistoryItem<T, PU> = {
  type: T;
  payload: PU;
}

export type HistoryItemUnion<PBT extends PayloadByType> =
  | {
    [T in keyof PBT]: HistoryItem<T, PBT[T]["payload"]>;
  }[keyof PBT];
// | HistoryItem<'start', void>;

export type StateWithHistory<S, PBT extends PayloadByType> = {
  state: S;
  history: {
    index: number;
    stack: HistoryItemUnion<PBT>[];
  },
  effects: ActionUnion<ValueByType<PBT>>[];
}

export type UActions = {
  type: 'undo'
} | {
  type: 'redo'
};