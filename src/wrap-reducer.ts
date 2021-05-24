import { append } from 'fp-ts/Array';
import { flow, identity, pipe } from 'fp-ts/function';
import { v4 } from 'uuid';
import {
  addHistoryItem,
  getBranchSwitchProps,
  getCurrentBranch,
  getCurrentIndex,
  redo,
  timeTravelCurrentBranch,
  undo,
  updatePath,
} from './internal';
import {
  PayloadConfigByType,
  PartialActionConfigByType,
  OriginalUActionUnion,
  UReducerOf,
  ReducerOf,
  OriginalActionUnion,
  UOptions,
  MetaAction,
} from './types/main';
import { evolve, when } from './util';

export const wrapReducer = <S, PBT extends PayloadConfigByType>(
  reducer: ReducerOf<S, PBT>,
  actionConfigs: PartialActionConfigByType<S, PBT>,
  options?: UOptions
): UReducerOf<S, PBT> => (uState, uReducerAction) => {
  const { state, history } = uState;
  const currentIndex = getCurrentIndex(history);
  const currentBranch = getCurrentBranch(history);

  const mergedOptions: Required<UOptions> = {
    useBranchingHistory: false,
    maxHistoryLength: Infinity,
    ...options,
  };

  const reduce = (action: OriginalActionUnion<PBT>) => (state: S) =>
    reducer(state, action);

  const action = uReducerAction as MetaAction;

  if (action.type === 'undo') {
    return pipe(
      uState,
      when(() => currentIndex >= 0, undo(reduce, actionConfigs))
    );
  } else if (action.type === 'redo') {
    return pipe(
      uState,
      when(
        () => currentIndex < currentBranch.stack.length - 1,
        redo(reduce, actionConfigs)
      )
    );
  } else if (action.type === 'timeTravel') {
    const { indexOnBranch, branchId = currentBranch.id } = action.payload;
    if (branchId === currentBranch.id) {
      return timeTravelCurrentBranch(
        reduce,
        actionConfigs,
        indexOnBranch
      )(uState);
    } else {
      const { caIndex, path, parentIndex } = getBranchSwitchProps(
        history,
        branchId
      );
      return pipe(
        uState,
        flow(
          when(
            () => caIndex < history.currentIndex,
            timeTravelCurrentBranch(reduce, actionConfigs, caIndex)
          ),
          evolve({ history: updatePath(path.map(b => b.id)) }),
          // current branch is updated
          timeTravelCurrentBranch(
            reduce,
            actionConfigs,
            parentIndex + 1 + indexOnBranch
          )
        )
      );
    }
  } else {
    const { type, payload, meta } = action as OriginalUActionUnion<PBT>;
    // TODO: is it safe to just remove 'meta' (what if the original action also had it)?
    const originalAction = { type, payload };

    const newState = reducer(state, originalAction);

    // TODO: what about deep equality?
    if (newState === state) {
      return uState;
    } else {
      const config = actionConfigs[type];
      const skipHistory = !config || meta?.skipHistory;
      // TODO: is check for !config necessary for skipping effects?
      // If used with Redux this reducer may receive unrelated actions.
      const skipEffects = !config || meta?.skipEffects;

      return pipe(
        uState,
        evolve({
          history: skipHistory
            ? identity
            : addHistoryItem(
                {
                  type,
                  payload: config.initPayload(state)(payload),
                  id: v4(),
                  created: new Date(),
                },
                mergedOptions
              ),
          state: () => newState,
          effects: skipEffects ? identity : append(originalAction),
        })
      );
    }
  }
};
