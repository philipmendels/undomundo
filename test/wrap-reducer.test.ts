import { negate } from 'fp-ts-std/Number';
import { pipe } from 'fp-ts/lib/function';
import { wrapReducer } from '../src';
import {
  makeDefaultPartialActionConfig,
  makeRelativePartialActionConfig,
} from '../src/helpers';
import {
  DefaultPayloadConfig,
  Reducer,
  RelativePayloadConfig,
  UState,
} from '../src/types';
import { add, evolve, merge, subtract } from '../src/util';

type State = {
  count: number;
};

type Actions =
  | {
      type: 'addToCount';
      payload: number;
    }
  | {
      type: 'subtractFromCount';
      payload: number;
    }
  | {
      type: 'updateCount';
      payload: number;
    };

type PBT = {
  updateCount: DefaultPayloadConfig<number>;
  addToCount: RelativePayloadConfig<number>;
  subtractFromCount: RelativePayloadConfig<number>;
};

let uState: UState<State, PBT> = {
  effects: [],
  history: {
    stack: [],
    index: -1,
  },
  state: {
    count: 3,
  },
};

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
  return state;
};

const uReducer = wrapReducer<State, PBT>(reducer, {
  addToCount: makeRelativePartialActionConfig({
    // payload conversion:
    makeActionForUndo: evolve({ payload: negate }),
  }),
  subtractFromCount: makeRelativePartialActionConfig({
    // type conversion:
    makeActionForUndo: ({ payload }) => ({ type: 'addToCount', payload }),
  }),
  updateCount: makeDefaultPartialActionConfig({
    updatePayload: state => _ => state.count,
  }),
});

describe('wrapReducer', () => {
  it('update works', () => {
    uState = uReducer(uState, {
      type: 'addToCount',
      payload: 3,
    });
    expect(uState.state.count).toBe(6);

    uState = uReducer(uState, {
      type: 'subtractFromCount',
      payload: 1,
    });
    expect(uState.state.count).toBe(5);

    uState = uReducer(uState, {
      type: 'updateCount',
      payload: 4,
    });

    expect(uState.state.count).toBe(4);

    expect(uState.history).toStrictEqual<typeof uState.history>({
      index: 2,
      stack: [
        {
          payload: 3,
          type: 'addToCount',
        },
        {
          payload: 1,
          type: 'subtractFromCount',
        },
        {
          payload: {
            undo: 5,
            redo: 4,
          },
          type: 'updateCount',
        },
      ],
    });
    expect(uState.effects).toStrictEqual<typeof uState.effects>([
      {
        type: 'addToCount',
        payload: 3,
      },
      {
        type: 'subtractFromCount',
        payload: 1,
      },
      {
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
    expect(uState.history.stack).toStrictEqual(prevUState.history.stack);
    expect(uState.effects).toStrictEqual<typeof uState.effects>(
      prevUState.effects.concat([
        {
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
    expect(uState).toBe(prevUState);
  });

  it('redo works', () => {
    const prevUState = uState;

    uState = uReducer(uState, { type: 'redo' });
    expect(uState.state.count).toBe(6);

    uState = uReducer(uState, { type: 'redo' });
    expect(uState.state.count).toBe(5);

    uState = uReducer(uState, { type: 'redo' });
    expect(uState.state.count).toBe(4);

    expect(uState.history.stack).toStrictEqual(prevUState.history.stack);
    expect(uState.effects).toStrictEqual<typeof uState.effects>(
      prevUState.effects.concat([
        {
          type: 'addToCount',
          payload: 3,
        },
        {
          type: 'subtractFromCount',
          payload: 1,
        },
        {
          type: 'updateCount',
          payload: 4,
        },
      ])
    );
  });

  it('ignores redo if no items to redo', () => {
    const prevUState = uState;
    uState = uReducer(uState, { type: 'redo' });
    expect(uState).toBe(prevUState);
  });

  it('ignores unknown action', () => {
    const prevUState = uState;
    uState = uReducer(uState, {
      type: 'some-unknown-type',
    } as any);
    expect(uState).toBe(prevUState);
  });

  it('ignores update that leads to referentially equal state', () => {
    const prevUState = uState;
    uState = uReducer(uState, {
      type: 'addToCount',
      payload: 0,
    });
    expect(uState.history).toBe(prevUState.history);
    expect(uState.effects).toBe(prevUState.effects);
  });

  // it('ignores absolute update that leads to referentially equal state', () => {
  //   const prevUState = uState;
  //   uState = uReducer(uState, {
  //     type: 'updateCount',
  //     payload: prevUState.state.count,
  //   });
  //   expect(uState.history).toBe(prevUState.history);
  //   expect(uState.effects).toBe(prevUState.effects);
  // });

  it('skip history works', () => {
    const prevUState = uState;
    uState = uReducer(uState, {
      type: 'addToCount',
      payload: 9,
      meta: {
        skipHistory: true,
      },
    });
    expect(uState.state.count).toBe(13);

    uState = uReducer(uState, {
      type: 'subtractFromCount',
      payload: 2,
      meta: {
        skipHistory: true,
      },
    });
    expect(uState.state.count).toBe(11);

    uState = uReducer(uState, {
      type: 'updateCount',
      payload: 33,
      meta: {
        skipHistory: true,
      },
    });
    expect(uState.state.count).toBe(33);

    expect(uState.history).toBe(prevUState.history);
    expect(uState.effects).toStrictEqual(
      prevUState.effects.concat([
        {
          type: 'addToCount',
          payload: 9,
        },
        {
          type: 'subtractFromCount',
          payload: 2,
        },
        {
          type: 'updateCount',
          payload: 33,
        },
      ])
    );
  });

  it('skip effects works', () => {
    const prevUState = uState;
    uState = uReducer(uState, {
      type: 'addToCount',
      payload: 2,
      meta: {
        skipEffects: true,
      },
    });
    expect(uState.state.count).toBe(35);

    uState = uReducer(uState, {
      type: 'subtractFromCount',
      payload: 7,
      meta: {
        skipEffects: true,
      },
    });
    expect(uState.state.count).toBe(28);

    uState = uReducer(uState, {
      type: 'updateCount',
      payload: 99,
      meta: {
        skipEffects: true,
      },
    });
    expect(uState.state.count).toBe(99);

    expect(uState.effects).toBe(prevUState.effects);
    expect(uState.history).toStrictEqual<typeof uState.history>({
      index: prevUState.history.index + 3,
      stack: prevUState.history.stack.concat([
        {
          payload: 2,
          type: 'addToCount',
        },
        {
          payload: 7,
          type: 'subtractFromCount',
        },
        {
          payload: {
            undo: 28,
            redo: 99,
          },
          type: 'updateCount',
        },
      ]),
    });
  });

  it('history rewrite works on undo', () => {
    uState = {
      effects: [],
      history: {
        stack: [],
        index: -1,
      },
      state: {
        count: 2,
      },
    };

    uState = uReducer(uState, {
      type: 'updateCount',
      payload: 4,
    });

    uState = uReducer(uState, {
      type: 'addToCount',
      payload: 3,
    });

    // external update of state:
    uState = uReducer(uState, {
      type: 'updateCount',
      payload: 9,
      meta: { skipEffects: true, skipHistory: true },
    });

    expect(uState.history).toStrictEqual<typeof uState.history>({
      index: 1,
      stack: [
        {
          payload: {
            undo: 2,
            redo: 4,
          },
          type: 'updateCount',
        },
        {
          payload: 3,
          type: 'addToCount',
        },
      ],
    });

    uState = uReducer(uState, { type: 'undo' });
    expect(uState.state.count).toBe(6);

    uState = uReducer(uState, { type: 'undo' });
    expect(uState.state.count).toBe(2);

    // redo in absolute payload is rewritten on undo:
    expect(uState.history).toStrictEqual<typeof uState.history>({
      index: -1,
      stack: [
        {
          payload: {
            undo: 2,
            redo: 6, // rewritten
          },
          type: 'updateCount',
        },
        {
          payload: 3,
          type: 'addToCount',
        },
      ],
    });
  });

  it('history rewrite works on redo', () => {
    // external update of state:
    uState = uReducer(uState, {
      type: 'updateCount',
      payload: -4,
      meta: { skipEffects: true, skipHistory: true },
    });

    uState = uReducer(uState, { type: 'redo' });
    expect(uState.state.count).toBe(6);
    uState = uReducer(uState, { type: 'redo' });
    expect(uState.state.count).toBe(9);

    // undo in absolute payload is rewritten on redo:
    expect(uState.history).toStrictEqual<typeof uState.history>({
      index: 1,
      stack: [
        {
          payload: {
            undo: -4, // rewritten
            redo: 6,
          },
          type: 'updateCount',
        },
        {
          payload: 3,
          type: 'addToCount',
        },
      ],
    });
  });
});
