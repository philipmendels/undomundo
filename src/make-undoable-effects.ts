import { identity } from 'fp-ts/function';
import { redo, switchToBranch, timeTravel, undo } from './action-creators';
import { makeUndoableReducer } from './make-undoable-reducer';
import { History } from './types/history';
import {
  PayloadConfigByType,
  UOptions,
  EffectConfigByType,
  ActionConfigByType,
  UReducerAction,
  Effect,
  UState,
  PayloadHandlersByType,
} from './types/main';
import { mapRecord } from './util';

type HistWithEffects<PBT extends PayloadConfigByType> = {
  history: History<PBT>;
  effects: Effect<PBT>[];
};

export type OnChangeEvent<PBT extends PayloadConfigByType> = {
  action: UReducerAction<PBT>;
  newHist: HistWithEffects<PBT>;
  oldHist: HistWithEffects<PBT>;
};

type OmitStrict<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export type MakeUndoableEffectsProps<S, PBT extends PayloadConfigByType> = {
  getState: () => S;
  getHistory: () => History<PBT>;
  effectConfigs: EffectConfigByType<S, PBT>;
  options?: OmitStrict<UOptions, 'checkStateEquals'>;
  onChange?: (event: OnChangeEvent<PBT>) => void;
};

export const makeUndoableEffects = <S, PBT extends PayloadConfigByType>({
  getState,
  getHistory,
  effectConfigs,
  options,
  onChange,
}: MakeUndoableEffectsProps<S, PBT>) => {
  let effects: Effect<PBT>[] = [];

  const getUState = (): UState<S, PBT> => ({
    effects: [],
    history: getHistory(),
    state: getState(),
  });

  const { uReducer, actionCreators } = makeUndoableReducer<S, PBT>(
    mapRecord(effectConfigs)<ActionConfigByType<S, PBT>>(config => ({
      ...config,
      // We could run the effects from within the two functions below,
      // but that would make the internal reducer impure.
      updateStateOnRedo: () => identity,
      updateStateOnUndo: () => identity,
    })),
    { ...options, checkStateEquals: false }
  );

  const withOnChange = (
    action: UReducerAction<PBT>,
    newUState: UState<S, PBT>
  ) => {
    const oldHistory = getHistory();
    const oldEffects = effects;
    const { history } = newUState;
    if (history !== oldHistory) {
      newUState.effects.forEach(({ direction, action }) => {
        if (direction === 'undo') {
          effectConfigs[action.type].onUndo(action.payload);
        } else {
          effectConfigs[action.type].onRedo(action.payload);
        }
      });
      effects = effects.concat(newUState.effects);
      onChange?.({
        action,
        oldHist: { history: oldHistory, effects: oldEffects },
        newHist: { history, effects },
      });
    }
    return newUState;
  };

  return {
    undoables: mapRecord(actionCreators)<
      PayloadHandlersByType<UState<S, PBT>, PBT>
    >(creator => (payload, skipHistory) => {
      const action = creator(payload, skipHistory);
      return withOnChange(
        action as UReducerAction<PBT>,
        uReducer(getUState(), action)
      );
    }),
    undo: () => {
      const action = undo();
      return withOnChange(action, uReducer(getUState(), action));
    },
    redo: () => {
      const action = redo();
      return withOnChange(action, uReducer(getUState(), action));
    },
    timeTravel: (...params: Parameters<typeof timeTravel>) => {
      const action = timeTravel(...params);
      return withOnChange(action, uReducer(getUState(), action));
    },
    switchToBranch: (...params: Parameters<typeof switchToBranch>) => {
      const action = switchToBranch(...params);
      return withOnChange(action, uReducer(getUState(), action));
    },
  };
};
