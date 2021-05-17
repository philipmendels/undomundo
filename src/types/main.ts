import { History } from './history';

export type Endomorphism<T> = (t: T) => T;

export type Updater<A, B> = (a: A) => Endomorphism<B>;

export type ValueOf<T> = T[keyof T];

export type StringMap = Record<string, any>;

export type Action<T = string, P = any> = {
  type: T;
  payload: P;
};

export type PayloadConfigByType = Record<string, PayloadConfig>;

export type AssociatedKeysOf<PBT extends PayloadConfigByType, PUR> = ValueOf<
  {
    [K in keyof PBT]: PBT[K]['undoRedo'] extends PUR ? K : never;
  }
>;

export type PayloadConfig<PO = any, PUR = any> = {
  original: PO;
  undoRedo: PUR;
};

export type RelativePayloadConfig<PO> = {
  original: PO;
  undoRedo: PO;
};

export type PayloadOriginalByType<PBT extends PayloadConfigByType> = {
  [K in keyof PBT]: PBT[K]['original'];
};

export type PayloadUndoRedoByType<PBT extends PayloadConfigByType> = {
  [K in keyof PBT]: PBT[K]['undoRedo'];
};

export type ActionUnion<PBT extends StringMap> = ValueOf<
  {
    [K in keyof PBT]: Action<K, PBT[K]>;
  }
>;

export type UndoableActionUnion<PBT extends StringMap> = ValueOf<
  {
    [K in keyof PBT]: Action<K, PBT[K]> & {
      undoMundo?: { isUndo?: boolean };
    };
  }
>;

export type UAction<T, P> = Action<T, P> & {
  meta?: UOptions;
};

export type UActionUnion<PBT extends StringMap> = ValueOf<
  {
    [K in keyof PBT]: UAction<K, PBT[K]>;
  }
>;

export type OriginalActionUnion<PBT extends PayloadConfigByType> = ActionUnion<
  PayloadOriginalByType<PBT>
>;

export type UndoRedoActionUnion<PBT extends PayloadConfigByType> = ActionUnion<
  PayloadUndoRedoByType<PBT>
>;

export type OriginalUActionUnion<
  PBT extends PayloadConfigByType
> = UActionUnion<PayloadOriginalByType<PBT>>;

export type PayloadMapping<PO, PUR> = {
  boxUndoRedo: (undo: PO, redo: PO) => PUR;
  getUndo: (payload: PUR) => PO;
  getRedo: (payload: PUR) => PO;
};

export type ActionConvertor<
  PBT extends PayloadConfigByType,
  K extends keyof PBT
> = (action: Action<K, PBT[K]['undoRedo']>) => OriginalActionUnion<PBT>;

export type PartialActionConfig<
  S,
  PBT extends PayloadConfigByType,
  K extends keyof PBT
> = {
  initPayload: (
    state: S
  ) => (original: PBT[K]['original']) => PBT[K]['undoRedo'];
  makeActionForUndo: ActionConvertor<PBT, K>;
  // Probably there is no real use-case for changing the action type on redo,
  // so perhaps 'makePayloadForRedo' would be better.
  makeActionForRedo: ActionConvertor<PBT, K>;
  updatePayloadOnUndo?: Updater<S, PBT[K]['undoRedo']>;
  updatePayloadOnRedo?: Updater<S, PBT[K]['undoRedo']>;
};

export type ActionConfig<
  S,
  PBT extends PayloadConfigByType,
  K extends keyof PBT
> = PartialActionConfig<S, PBT, K> & {
  updateStateOnRedo: Updater<PBT[K]['original'], S>;
  updateStateOnUndo: Updater<PBT[K]['original'], S>;
};

export type PartialActionConfigByType<S, PBT extends PayloadConfigByType> = {
  [K in keyof PBT]: PartialActionConfig<S, PBT, K>;
};

export type ActionConfigByType<S, PBT extends PayloadConfigByType> = {
  [K in keyof PBT]: ActionConfig<S, PBT, K>;
};

export type DefaultPayload<T> = { undo: T; redo: T };
export type FromToPayload<T> = { from: T; to: T };
export type TuplePayload<T> = [T, T];

export type DefaultPayloadConfig<T> = PayloadConfig<T, DefaultPayload<T>>;
export type FromToPayloadConfig<T> = PayloadConfig<T, FromToPayload<T>>;
export type TuplePayloadConfig<T> = PayloadConfig<T, TuplePayload<T>>;

export type UpdatersByType<S, PBT extends StringMap> = {
  [K in keyof PBT]: { undo: Updater<PBT[K], S>; redo: Updater<PBT[K], S> };
};

export type ActionCreatorsByType<PBT extends StringMap> = {
  [K in keyof PBT]: (payload: PBT[K]) => Action<K, PBT[K]>;
};

type UOptions = {
  skipHistory?: boolean;
  skipEffects?: boolean;
};

export type UActionCreatorsByType<PBT extends StringMap> = {
  [K in keyof PBT]: (payload: PBT[K], options?: UOptions) => UAction<K, PBT[K]>;
};

export type PayloadHandlersByType<S, PBT extends PayloadConfigByType> = {
  [K in keyof PBT]: (p: PBT[K]['original'], options?: UOptions) => S;
};

export type UState<S, PBT extends PayloadConfigByType> = {
  state: S;
  history: History<PBT>;
  effects: OriginalActionUnion<PBT>[];
};

export type MetaAction =
  | {
      type: 'undo';
    }
  | {
      type: 'redo';
    };

export type Reducer<S, A> = (state: S, action: A) => S;

export type ReducerOf<S, PBT extends PayloadConfigByType> = Reducer<
  S,
  UndoableActionUnion<PayloadOriginalByType<PBT>>
>;

export type UReducerAction<PBT extends PayloadConfigByType> =
  | MetaAction
  | OriginalUActionUnion<PBT>;

export type UReducerOf<S, PBT extends PayloadConfigByType> = Reducer<
  UState<S, PBT>,
  UReducerAction<PBT>
>;
