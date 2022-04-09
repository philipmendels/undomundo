import { negate } from 'fp-ts-std/Number';
import { pipe } from 'fp-ts/lib/function';
import { HistoryActionUnion, wrapReducer } from '../src';
import { initUState } from '../src/helpers';
import {
  getCurrentBranch,
  getCurrentBranchActions,
  getCurrentIndex,
} from '../src/internal';
import {
  Reducer,
  AbsolutePayloadConfig,
  CustomPayloadConfig,
  StateActionUnion,
} from '../src/types/main';
import { add, evolve, merge, subtract } from '../src/util';

type State = {
  count: number;
  someNonUndoableState: string;
};

const extra = {
  bloop: 'bloop',
};

type NUA = {
  type: 'someNonUndoableAction';
  payload: string;
};

type Actions =
  | NUA
  | {
      type: 'addToCount';
      payload: number;
    }
  | {
      type: 'subtractFromCount';
      payload: number;
    }
  | ({
      type: 'updateCount';
      payload: number;
    } & typeof extra);

type PBT = {
  updateCount: AbsolutePayloadConfig<number> & {
    extra: typeof extra;
  };
  addToCount: CustomPayloadConfig<number>;
  subtractFromCount: CustomPayloadConfig<number>;
};

let uState = initUState<State, PBT>({
  count: 3,
  someNonUndoableState: 'a',
});

const reducer: Reducer<State, Actions> = (state, action) => {
  if (action.type === 'addToCount') {
    const { payload } = action;
    // payload === 0 check is added for testing if an update that leads to a
    // referentially equal state is not added to the undo history
    return payload === 0 ? state : pipe(state, evolve({ count: add(payload) }));
  }
  if (action.type === 'subtractFromCount') {
    return pipe(state, evolve({ count: subtract(action.payload) }));
  }
  if (action.type === 'updateCount') {
    return pipe(state, merge({ count: action.payload }));
  }
  if (action.type === 'someNonUndoableAction') {
    return pipe(state, merge({ someNonUndoableState: action.payload }));
  }
  return state;
};

const { uReducer, actionCreators, getActionFromStateUpdate } = wrapReducer<
  State,
  PBT,
  Record<string, unknown>,
  NUA
>({
  reducer,
  actionConfigs: {
    addToCount: {
      // payload conversion:
      makeActionForUndo: evolve({ payload: negate }),
    },
    subtractFromCount: {
      // type conversion:
      makeActionForUndo: ({ payload }) => ({ type: 'addToCount', payload }),
    },
    updateCount: {
      updateHistory: state => () => state.count,
    },
  },
  options: {
    keepStateUpdates: true,
    isStateEqual: (current, prev) => current === prev,
  },
});

const { addToCount, updateCount, subtractFromCount } = actionCreators;

const convert = getActionFromStateUpdate({ isSynchronizing: false });

describe('wrapReducer', () => {
  it('nonUndoableAction works', () => {
    uState = uReducer(uState, {
      type: 'someNonUndoableAction',
      payload: 'b',
    });
    expect(uState.state.someNonUndoableState).toBe('b');
  });

  it('update works', () => {
    uState = uReducer(uState, addToCount(3));
    expect(uState.state.count).toBe(6);

    uState = uReducer(uState, subtractFromCount(1));
    expect(uState.state.count).toBe(5);

    uState = uReducer(uState, updateCount(4, { extra }));

    expect(uState.state.count).toBe(4);

    expect(getCurrentIndex(uState.history)).toBe(2);
    expect(getCurrentBranchActions(uState.history)).toStrictEqual<
      HistoryActionUnion<PBT>[]
    >([
      {
        payload: 3,
        type: 'addToCount',
      },
      {
        payload: 1,
        type: 'subtractFromCount',
      },
      {
        payload: { undo: 5, redo: 4 },
        type: 'updateCount',
        extra,
      },
    ]);
    expect(uState.stateUpdates.map(convert)).toStrictEqual<
      StateActionUnion<PBT>[]
    >([
      {
        type: 'addToCount',
        payload: 3,
      },
      {
        type: 'subtractFromCount',
        payload: 1,
      },
      {
        ...extra,
        type: 'updateCount',
        payload: 4,
      },
    ]);
  });

  it('undo works', () => {
    const prevUState = uState;
    uState = uReducer(uState, { type: 'undo' });
    expect(uState.state.count).toBe(5);

    uState = uReducer(uState, { type: 'undo' });
    expect(uState.state.count).toBe(6);

    uState = uReducer(uState, { type: 'undo' });
    expect(uState.state.count).toBe(3);

    // Cannot use .toBe because history gets rewritten
    // TODO: add optimization to check if history needs to be rewritten for absolute update
    expect(getCurrentBranch(uState.history)).toStrictEqual(
      getCurrentBranch(prevUState.history)
    );
    expect(uState.stateUpdates.map(convert)).toStrictEqual<
      StateActionUnion<PBT>[]
    >(
      prevUState.stateUpdates.map(convert).concat([
        {
          ...extra,
          type: 'updateCount',
          payload: 5,
        },
        {
          // action type is converted for undo:
          type: 'addToCount',
          payload: 1,
        },
        {
          type: 'addToCount',
          payload: -3,
        },
      ])
    );
  });

  it('ignores undo if no items to undo', () => {
    const prevUState = uState;
    uState = uReducer(uState, { type: 'undo' });
    expect(uState.state).toBe(prevUState.state);
    expect(uState.history).toBe(prevUState.history);
  });

  it('redo works', () => {
    const prevUState = uState;

    uState = uReducer(uState, { type: 'redo' });
    expect(uState.state.count).toBe(6);

    uState = uReducer(uState, { type: 'redo' });
    expect(uState.state.count).toBe(5);

    uState = uReducer(uState, { type: 'redo' });
    expect(uState.state.count).toBe(4);

    expect(getCurrentBranch(uState.history)).toStrictEqual(
      getCurrentBranch(prevUState.history)
    );
    expect(uState.stateUpdates.map(convert)).toStrictEqual<
      StateActionUnion<PBT>[]
    >(
      prevUState.stateUpdates.map(convert).concat([
        {
          type: 'addToCount',
          payload: 3,
        },
        {
          type: 'subtractFromCount',
          payload: 1,
        },
        {
          ...extra,
          type: 'updateCount',
          payload: 4,
        },
      ])
    );
  });

  it('ignores redo if no items to redo', () => {
    const prevUState = uState;
    uState = uReducer(uState, { type: 'redo' });
    expect(uState.state).toBe(prevUState.state);
    expect(uState.history).toBe(prevUState.history);
  });

  it('ignores unknown action', () => {
    const prevUState = uState;
    uState = uReducer(uState, {
      type: 'some-unknown-type',
    } as any);
    expect(uState.state).toBe(prevUState.state);
    expect(uState.history).toBe(prevUState.history);
  });

  it('ignores update that leads to referentially equal state', () => {
    const prevUState = uState;
    uState = uReducer(uState, addToCount(0));
    expect(uState.history).toBe(prevUState.history);
    expect(uState.stateUpdates).toBe(prevUState.stateUpdates);
  });

  // it('ignores absolute update that leads to referentially equal state', () => {
  //   const prevUState = uState;
  //   uState = uReducer(uState, {
  //     type: 'updateCount',
  //     payload: prevUState.state.count,
  //   });
  //   expect(uState.history).toBe(prevUState.history);
  //   expect(uState.output).toBe(prevUState.output);
  // });

  it('skip history works', () => {
    const prevUState = uState;
    uState = uReducer(uState, addToCount(9, { skipHistory: true }));
    expect(uState.state.count).toBe(13);

    uState = uReducer(uState, subtractFromCount(2, { skipHistory: true }));
    expect(uState.state.count).toBe(11);

    uState = uReducer(uState, updateCount(33, { extra, skipHistory: true }));
    expect(uState.state.count).toBe(33);

    expect(uState.history).toBe(prevUState.history);
    expect(uState.stateUpdates.map(convert)).toStrictEqual<
      StateActionUnion<PBT>[]
    >(
      prevUState.stateUpdates.map(convert).concat([
        {
          type: 'addToCount',
          payload: 9,
        },
        {
          type: 'subtractFromCount',
          payload: 2,
        },
        {
          ...extra,
          type: 'updateCount',
          payload: 33,
        },
      ])
    );
  });

  it('isSynchronizing works', () => {
    const prevUState = uState;
    uState = uReducer(uState, {
      type: 'addToCount',
      payload: 2,
      undomundo: { isSynchronizing: true },
    });
    expect(uState.state.count).toBe(35);

    uState = uReducer(uState, {
      type: 'subtractFromCount',
      payload: 7,
      undomundo: { isSynchronizing: true },
    });
    expect(uState.state.count).toBe(28);

    uState = uReducer(uState, {
      ...extra,
      type: 'updateCount',
      payload: 99,
      undomundo: { isSynchronizing: true },
    });
    expect(uState.state.count).toBe(99);

    expect(uState.stateUpdates).toStrictEqual(prevUState.stateUpdates);
    expect(uState.historyUpdates).toStrictEqual(prevUState.historyUpdates);
    expect(uState.history).toBe(prevUState.history);
  });

  it('history rewrite works on undo', () => {
    uState = initUState<State, PBT>({
      count: 2,
      someNonUndoableState: 'a',
    });

    uState = uReducer(uState, updateCount(4, { extra }));

    uState = uReducer(uState, addToCount(3));

    // external update of state:
    uState = uReducer(uState, {
      type: 'updateCount',
      payload: 9,
      undomundo: { isSynchronizing: true },
      bloop: 'a',
    });

    expect(getCurrentIndex(uState.history)).toBe(1);
    expect(getCurrentBranchActions(uState.history)).toStrictEqual<
      HistoryActionUnion<PBT>[]
    >([
      {
        payload: { undo: 2, redo: 4 },
        type: 'updateCount',
        extra,
      },
      {
        payload: 3,
        type: 'addToCount',
      },
    ]);

    uState = uReducer(uState, { type: 'undo' });
    expect(uState.state.count).toBe(6);

    uState = uReducer(uState, { type: 'undo' });
    expect(uState.state.count).toBe(2);

    expect(getCurrentIndex(uState.history)).toBe(-1);
    // redo in absolute payload is rewritten on undo:
    expect(getCurrentBranchActions(uState.history)).toStrictEqual<
      HistoryActionUnion<PBT>[]
    >([
      {
        payload: {
          undo: 2,
          redo: 6, // rewritten
        },
        type: 'updateCount',
        extra,
      },
      {
        payload: 3,
        type: 'addToCount',
      },
    ]);
  });

  it('history rewrite works on redo', () => {
    // external update of state:
    uState = uReducer(uState, {
      type: 'updateCount',
      payload: -4,
      bloop: 'c',
      undomundo: {
        isSynchronizing: true,
      },
    });

    uState = uReducer(uState, { type: 'redo' });
    expect(uState.state.count).toBe(6);
    uState = uReducer(uState, { type: 'redo' });
    expect(uState.state.count).toBe(9);

    expect(getCurrentIndex(uState.history)).toBe(1);
    // undo in absolute payload is rewritten on undo:
    expect(getCurrentBranchActions(uState.history)).toStrictEqual<
      HistoryActionUnion<PBT>[]
    >([
      {
        payload: {
          undo: -4, // rewritten
          redo: 6,
        },
        type: 'updateCount',
        extra,
      },
      {
        payload: 3,
        type: 'addToCount',
      },
    ]);
  });
});
