import {
  UndoMap,
  PayloadByType,
  Reducer,
  ActionUnion,
  ValueByType,
  RI,
  UndoMapByType,
  StateWithHistory,
  UActions,
  UActionUnion,
} from './types';

const updateOnUndo = <S, V, P>(state: S, payload: P, map: UndoMap<S, V, P>) =>
  map.payloadMap.init(
    map.payloadMap.getUndo(payload),
    map.getValue(state)(map.payloadMap.getDrdo(payload))
  );

const updateOnRedo = <S, V, P>(state: S, payload: P, map: UndoMap<S, V, P>) =>
  map.payloadMap.init(
    map.payloadMap.getUndo(payload),
    map.getValue(state)(map.payloadMap.getDrdo(payload))
  );

const makePayload = <S, V, P>(state: S, value: V, map: UndoMap<S, V, P>) =>
  map.payloadMap.init(map.getValue(state)(value), value);

export const wrapReducer = <S, PBT extends PayloadByType>(
  reducer: Reducer<S, ActionUnion<ValueByType<RI<PBT>>>>,
  payloadMaps: UndoMapByType<S, RI<PBT>>
): Reducer<
  StateWithHistory<S, RI<PBT>>,
  UActions | UActionUnion<ValueByType<RI<PBT>>>
> => (stateWithHist, action) => {
  const { state, history, effects } = stateWithHist;
  if (action.type === 'undo') {
    if (history.index >= 0) {
      const item = history.stack[history.index];
      const { type, payload } = item;
      const umap = payloadMaps[type];
      item.payload = updateOnUndo(state, payload, umap);
      const newAction = { type, payload: umap.payloadMap.getUndo(payload) };
      return {
        history: {
          ...history,
          index: history.index - 1,
        },
        state: reducer(state, newAction),
        effects: [...effects, newAction],
      };
    } else {
      return stateWithHist;
    }
  } else if (action.type === 'redo') {
    const lastIndex = history.stack.length - 1;
    if (history.index < lastIndex) {
      const item = history.stack[history.index + 1];
      const { type, payload } = item;
      const umap = payloadMaps[type];
      item.payload = updateOnRedo(state, payload, umap);
      const newAction = { type, payload: umap.payloadMap.getDrdo(payload) };
      return {
        history: {
          ...history,
          index: history.index + 1,
        },
        state: reducer(state, newAction),
        effects: [...effects, newAction],
      };
    } else {
      return stateWithHist;
    }
  } else {
    const { type, payload, meta } = action as UActionUnion<
      ValueByType<RI<PBT>>
    >;
    const originalAction = { type, payload }; // TODO: it is not correct to just remove meta...
    const umap = payloadMaps[type];
    const skip = meta?.skipAddToHist;
    return {
      // TODO: do we want to store the full hist of effects including the external ones?
      effects: skip ? effects : [...effects, originalAction],
      history: skip
        ? history
        : {
            index: history.index + 1, // TODO: remove future or new branch
            stack: [
              ...history.stack,
              { type, payload: makePayload(state, payload, umap) },
            ],
          },
      state: reducer(state, originalAction),
    };
  }
};
