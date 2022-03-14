/* eslint-disable no-prototype-builtins */
import {
  AbsoluteActionConfig,
  ActionConfigByType,
  ActionConvertor,
  PayloadConfigByType,
  RelativeActionConfig,
  UReducerAction,
  HistoryOptions,
  UActionOptions,
  UState,
} from './types/main';
import { CustomData, History, InitBranchData } from './types/history';

import { mapRecord, mapRecordWithKey } from '../src/util';
import {
  canRedo,
  canUndo,
  createEmptyHistory,
  getCurrentBranch,
  initHistory,
} from './helpers';
import { undo, redo, timeTravel, switchToBranch } from './action-creators';

import { wrapReducer } from './wrap-reducer';

type State = Record<string, unknown>;

type HandlersByType<PBT extends PayloadConfigByType, R> = {
  [K in keyof PBT]: PBT[K]['isRelative'] extends true
    ? RelativeHandler<PBT[K]['payload'], R>
    : AbsoluteHandler<PBT[K]['payload'], R>;
};

type ActionOptions = Pick<UActionOptions<any>, 'skipHistory' | 'skipState'>;

type RelativeHandler<P, R> = (payload: P, options?: ActionOptions) => R;
type AbsoluteHandler<P, R> = (undo: P, redo: P, options?: ActionOptions) => R;

export type RelativeEffectConfig<
  PBT extends PayloadConfigByType,
  K extends keyof PBT
> = {
  makeActionForUndo: ActionConvertor<PBT, K>;
  updateState: (payload: PBT[K]['payload']) => void;
  updateStateOnUndo?: (payload: PBT[K]['payload']) => void;
};

export type AbsoluteEffectConfig<P> = {
  updateState: (payload: P) => void;
};

export type EffectConfigs<PBT extends PayloadConfigByType> = {
  [K in keyof PBT]: PBT[K]['isRelative'] extends true
    ? RelativeEffectConfig<PBT, K>
    : AbsoluteEffectConfig<PBT[K]['payload']>;
};

const isRelativeConfig = (
  config: RelativeEffectConfig<any, string> | AbsoluteEffectConfig<any>
): config is RelativeEffectConfig<any, string> =>
  config.hasOwnProperty('makeActionForUndo');

export type HistoryOnChangeEvent<
  PBT extends PayloadConfigByType,
  CBD extends CustomData
> = {
  actions: UReducerAction<PBT>[];
  newHistory: History<PBT, CBD>;
  oldHistory: History<PBT, CBD>;
};

export type MakeUndoableEffectsProps<
  PBT extends PayloadConfigByType,
  CBD extends CustomData = Record<string, unknown>
> = {
  actionConfigs: EffectConfigs<PBT>;
  options?: HistoryOptions;
  onChange?: (event: HistoryOnChangeEvent<PBT, CBD>) => void;
  initialHistory?: History<PBT, CBD>;
  initBranchData?: InitBranchData<PBT, CBD>;
};

export const makeUndoableEffects = <
  PBT extends PayloadConfigByType,
  CBD extends CustomData = Record<string, unknown>
>({
  initialHistory,
  actionConfigs,
  options,
  onChange,
  initBranchData,
}: MakeUndoableEffectsProps<PBT, CBD>) => {
  let uState: UState<State, PBT, CBD> = {
    state: {},
    history:
      initialHistory ?? initHistory(initBranchData?.(createEmptyHistory())),
    historyUpdates: [],
    stateUpdates: [],
  };

  const { uReducer, actionCreators, getActionFromStateUpdate } = wrapReducer<
    State,
    PBT,
    CBD
  >({
    reducer: () => ({}),
    actionConfigs: mapRecord(actionConfigs)<ActionConfigByType<State, PBT>>(
      config => {
        if (isRelativeConfig(config)) {
          return {
            updateHistory: () => h => h,
            updateState: () => s => s,
            makeActionForUndo: config.makeActionForUndo,
            updateStateOnUndo: config.updateStateOnUndo
              ? () => s => s
              : undefined,
          } as RelativeActionConfig<State, PBT, string> as any;
        } else {
          return {
            updateHistory: () => h => h,
            updateState: () => s => s,
          } as AbsoluteActionConfig<State, PBT, string> as any;
        }
      }
    ),
    options: {
      ...options,
      disableUpdateHistory: true,
    },
    initBranchData,
  });

  const handleEffects = () => {
    uState.stateUpdates
      .filter(update => !update.skipState)
      .map(getActionFromStateUpdate({ isSynchronizing: false }))
      .forEach(({ type, payload, undomundo }) => {
        const config = actionConfigs[type];
        if (
          isRelativeConfig(config) &&
          config.updateStateOnUndo &&
          undomundo?.isUndo
        ) {
          config.updateStateOnUndo(payload);
        } else {
          config.updateState(payload);
        }
      });
  };

  const withOnChange = (
    actions: UReducerAction<PBT>[],
    newUState: UState<State, PBT, CBD>
  ) => {
    const oldUState = uState;
    uState = newUState;
    handleEffects();
    onChange?.({
      actions,
      newHistory: newUState.history,
      oldHistory: oldUState.history,
    });
    return newUState.history;
  };

  const undoables = mapRecordWithKey(actionConfigs)<
    HandlersByType<PBT, History<PBT, CBD>>
  >((type, config) => {
    if (isRelativeConfig(config)) {
      return ((payload: any) => {
        const action = (actionCreators[type] as any)(payload);
        return withOnChange([action], uReducer(uState, action));
      }) as RelativeHandler<any, History<PBT, CBD>> as any;
    } else {
      return ((undo: any, redo: any) => {
        const action = (actionCreators[type] as any)(redo, {
          undoValue: undo,
        });
        return withOnChange([action], uReducer(uState, action));
      }) as AbsoluteHandler<any, History<PBT, CBD>> as any;
    }
  });

  return {
    getCurrentHistory: () => uState.history,
    setHistory: (history: History<PBT, CBD>) =>
      (uState = { ...uState, history }),
    undoables,
    getCurrentBranch: () => getCurrentBranch(uState.history),
    canUndo: () => canUndo(uState.history),
    canRedo: () => canRedo(uState.history),
    undo: () => {
      const action = undo();
      return withOnChange([action], uReducer(uState, action));
    },
    redo: () => {
      const action = redo();
      return withOnChange([action], uReducer(uState, action));
    },
    timeTravel: (...params: Parameters<typeof timeTravel>) => {
      const action = timeTravel(...params);
      return withOnChange([action], uReducer(uState, action));
    },
    switchToBranch: (...params: Parameters<typeof switchToBranch>) => {
      const action = switchToBranch(...params);
      return withOnChange([action], uReducer(uState, action));
    },
  };
};
