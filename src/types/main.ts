import {
  CustomData,
  History,
  HistoryActionUnion,
  HistoryItemUnion,
  HistoryPayloadUnion,
} from './history';

export type Endomorphism<T> = (t: T) => T;

export type Updater<A, B> = (a: A) => Endomorphism<B>;

export type ValueOf<T> = T[keyof T];

export type StringMap<T = any> = Record<string, T>;

export type Action<T = string, P = any> = {
  type: T;
  payload: P;
};

export type PayloadConfigByType = Record<string, PayloadConfig>;

export type PayloadConfig<P = any> = {
  payload: P;
  isRelative?: boolean;
  extra?: StringMap;
};

export type AbsolutePayloadConfig<T> = {
  payload: T;
  isRelative: false;
};

export type RelativePayloadConfig<T> = {
  payload: T;
  isRelative: true;
};

export type OriginalPayloadByType<PBT extends PayloadConfigByType> = {
  [K in keyof PBT]: PBT[K]['payload'];
};

export type ActionUnion<PBT extends StringMap> = ValueOf<
  {
    [K in keyof PBT]: Action<K, PBT[K]>;
  }
>;

export type StateAction<T, P extends PayloadConfig> = Action<T, P['payload']> &
  P['extra'] & {
    undomundo?: { isUndo?: boolean };
  };

export type StateActionUnion<PBT extends PayloadConfigByType> = ValueOf<
  {
    [K in keyof PBT]: StateAction<K, PBT[K]>;
  }
>;

export type UAction<T, P extends PayloadConfig> = Action<T, P['payload']> & {
  undomundo: {
    id: string;
    created: string;
  } & UActionOptions<P>;
};

export type SyncAction<T, P extends PayloadConfig> = StateAction<T, P> & {
  undomundo: {
    isSynchronizing: true;
  };
};

export type SyncActionUnion<PBT extends PayloadConfigByType> = ValueOf<
  {
    [K in keyof PBT]: SyncAction<K, PBT[K]>;
  }
>;

export type UActionUnion<PBT extends PayloadConfigByType> = ValueOf<
  {
    [K in keyof PBT]: UAction<K, PBT[K]>;
  }
>;

export type PayloadMapping<PO, PH> = {
  composeUndoRedo: (undo: PO, redo: PO) => PH;
  getUndo: (payload: PH) => PO;
  getRedo: (payload: PH) => PO;
};

export type ActionConvertor<
  PBT extends PayloadConfigByType,
  K extends keyof PBT
> = (
  action: Action<K, PBT[K]['payload']> & PBT[K]['extra']
) => StateActionUnion<PBT>;

export type RelativePartialActionConfig<
  S,
  PBT extends PayloadConfigByType,
  K extends keyof PBT
> = {
  makeActionForUndo: ActionConvertor<PBT, K>;
  updateHistory?: Updater<S, PBT[K]['payload']>;
};

export type RelativePartialActionConfigByType<
  S,
  PBT extends PayloadConfigByType
> = {
  [K in keyof PBT]: RelativePartialActionConfig<S, PBT, K>;
};

export type RelativePartialActionConfigUnion<
  S,
  PBT extends PayloadConfigByType
> = ValueOf<RelativePartialActionConfigByType<S, PBT>>;

export type RelativeActionConfig<
  S,
  PBT extends PayloadConfigByType,
  K extends keyof PBT
> = RelativePartialActionConfig<S, PBT, K> & {
  updateState: Updater<PBT[K]['payload'], S>;
  updateStateOnUndo?: Updater<PBT[K]['payload'], S>;
};

export type AbsolutePartialActionConfig<
  S,
  PBT extends PayloadConfigByType,
  K extends keyof PBT
> = {
  updateHistory: Updater<S, PBT[K]['payload']>;
  initUndoValue?: Updater<S, PBT[K]['payload']>;
};

export type AbsoluteActionConfig<
  S,
  PBT extends PayloadConfigByType,
  K extends keyof PBT
> = AbsolutePartialActionConfig<S, PBT, K> & {
  updateState: Updater<PBT[K]['payload'], S>;
};

export type AbsolutePartialActionConfigByType<
  S,
  PBT extends PayloadConfigByType
> = {
  [K in keyof PBT]: AbsolutePartialActionConfig<S, PBT, K>;
};

export type AbsolutePartialActionConfigUnion<
  S,
  PBT extends PayloadConfigByType
> = ValueOf<AbsolutePartialActionConfigByType<S, PBT>>;

export type PartialActionConfigsAsUnion<S, PBT extends PayloadConfigByType> =
  | RelativePartialActionConfigUnion<S, PBT>
  | AbsolutePartialActionConfigUnion<S, PBT>;

export type PartialActionConfig<
  S,
  PBT extends PayloadConfigByType,
  K extends keyof PBT
> = PBT[K]['isRelative'] extends true
  ? RelativePartialActionConfig<S, PBT, K>
  : AbsolutePartialActionConfig<S, PBT, K>;

export type ActionConfig<
  S,
  PBT extends PayloadConfigByType,
  K extends keyof PBT
> = PBT[K]['isRelative'] extends true
  ? RelativeActionConfig<S, PBT, K>
  : AbsoluteActionConfig<S, PBT, K>;

export type PartialActionConfigByType<S, PBT extends PayloadConfigByType> = {
  [K in keyof PBT]: PartialActionConfig<S, PBT, K>;
};

export type PartialActionConfigUnion<
  S,
  PBT extends PayloadConfigByType
> = ValueOf<PartialActionConfigByType<S, PBT>>;

export type ActionConfigByType<S, PBT extends PayloadConfigByType> = {
  [K in keyof PBT]: ActionConfig<S, PBT, K>;
};

export type AbsolutePayload<T> = { undo: T; redo: T };

export type UpdatersByType<S, PBT extends StringMap> = {
  [K in keyof PBT]: { undo: Updater<PBT[K], S>; redo: Updater<PBT[K], S> };
};

export type ActionCreatorsByType<PBT extends PayloadConfigByType> = {
  [K in keyof PBT]: (
    payload: PBT[K]['payload'],
    extra?: PBT[K]['extra']
  ) => Action<K, PBT[K]['payload']> & PBT[K]['extra'];
};

type UActionOptions<P extends PayloadConfig> = {
  skipHistory?: boolean;
  // skipState is e.g. for the drop at the end of a drag, with
  // relative positioning. At the drop will full delta
  // needs to be added to the history, but not to the state because
  // all the intermediate drag delta's are already added to the state
  // (and not to the history).
  skipState?: boolean; // does not make sense for absolute action
  undoValue?: P['payload']; // does not make sense for relative action
} & (P['extra'] extends StringMap
  ? {
      extra: P['extra'];
    }
  : {
      extra?: never;
    });

// // named tuple can't be parsed somehow
// type CreatorArgs<P extends PayloadConfig> = P['extra'] extends StringMap
//   // eslint-disable-next-line prettier/prettier
//   ? [payload: P['payload'], options: UActionOptions<P>]
//   : [payload: P['payload'], options?: UActionOptions<P>];

type CreatorArgs<P extends PayloadConfig> = P['extra'] extends StringMap
  ? [P['payload'], UActionOptions<P>]
  : [P['payload'], UActionOptions<P>?];

export type UActionCreator<K, P extends PayloadConfig> = (
  ...args: CreatorArgs<P>
) => UAction<K, P>;

export type UActionCreatorsByType<PBT extends PayloadConfigByType> = {
  [K in keyof PBT]: UActionCreator<K, PBT[K]>;
};

export type PayloadHandlersByType<S, PBT extends PayloadConfigByType> = {
  [K in keyof PBT]: (...args: CreatorArgs<PBT[K]>) => S;
};

export type HistoryUpdate<PBT extends PayloadConfigByType> =
  | {
      type: 'UNDO_WITH_UPDATE';
      payload?: HistoryPayloadUnion<PBT>;
    }
  | {
      type: 'REDO_WITH_UPDATE';
      payload?: HistoryPayloadUnion<PBT>;
    }
  | {
      type: 'ADD_TO_HISTORY';
      payload: HistoryItemUnion<PBT>;
    }
  | {
      type: 'STORE_INDEX';
    }
  | {
      type: 'REBUILD_BRANCHES';
      payload: string[];
    };

export type StateUpdate<PBT extends PayloadConfigByType> = {
  direction: 'undo' | 'redo';
  action: HistoryActionUnion<PBT>;
  skipHistory?: boolean;
  skipState?: boolean;
};

export type UState<
  S,
  PBT extends PayloadConfigByType,
  CustomBranchData extends CustomData = {}
> = {
  state: S;
  history: History<PBT, CustomBranchData>;
  stateUpdates: StateUpdate<PBT>[];
  historyUpdates: HistoryUpdate<PBT>[];
};

export type UndoAction = {
  type: 'undo';
};

export type RedoAction = {
  type: 'redo';
};

export type TimeTravelAction = {
  type: 'timeTravel';
  payload: {
    branchId?: string;
    indexOnBranch: number;
  };
};

export type ClearStateUpdatesAction = {
  type: 'clearStateUpdates';
  // deleteCount
  payload?: number;
};

export type ClearHistoryUpdatesAction = {
  type: 'clearHistoryUpdates';
  // deleteCount
  payload?: number;
};

export type BranchSwitchModus =
  | 'LAST_COMMON_ACTION_IF_PAST'
  | 'LAST_COMMON_ACTION'
  | 'HEAD_OF_BRANCH'
  | 'LAST_KNOWN_POSITION_ON_BRANCH';

export type SwitchToBranchAction = {
  type: 'switchToBranch';
  payload: {
    branchId: string;
    travelTo?: BranchSwitchModus;
  };
};

export type MetaAction =
  | UndoAction
  | RedoAction
  | TimeTravelAction
  | SwitchToBranchAction
  | ClearStateUpdatesAction
  | ClearHistoryUpdatesAction;

export type Reducer<S, A> = (state: S, action: A) => S;

export type ReducerOf<S, PBT extends PayloadConfigByType, NUA> = Reducer<
  S,
  StateActionUnion<PBT> | NUA
>;

export type UReducerAction<PBT extends PayloadConfigByType> =
  | MetaAction
  | UActionUnion<PBT>
  | SyncActionUnion<PBT>;

export type UReducerOf<
  S,
  PBT extends PayloadConfigByType,
  CustomBranchData extends CustomData = {},
  NUA = never
> = Reducer<UState<S, PBT, CustomBranchData>, UReducerAction<PBT> | NUA>;

export type HistoryOptions = {
  useBranchingHistory?: boolean;
  maxHistoryLength?: number;
};

export type UOptions<S> = HistoryOptions & {
  keepStateUpdates?: boolean;
  keepHistoryUpdates?: boolean;
  disableUpdateHistory?: boolean;
  isStateEqual?: (current: S, prev: S) => boolean;
};

export type OmitStrict<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
