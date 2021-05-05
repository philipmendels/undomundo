import { StateWithHistory } from '../src/types';
import { PBT, State, uReducer } from './shared';

describe('wrapReducer', () => {
  let uState: StateWithHistory<State, PBT> = {
    effects: [],
    history: {
      stack: [],
      index: -1,
    },
    state: {
      count: 3,
    },
  };

  it('update works', () => {
    uState = uReducer(uState, {
      type: 'addToCount',
      payload: 3,
    });
    expect(uState.state.count).toBe(6);

    uState = uReducer(uState, {
      type: 'updateCount',
      payload: 4,
    });

    expect(uState.state.count).toBe(4);
    expect(uState.history).toStrictEqual<typeof uState.history>({
      index: 1,
      stack: [
        {
          payload: 3,
          type: 'addToCount',
        },
        {
          payload: {
            undo: 6,
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
        type: 'updateCount',
        payload: 4,
      },
    ]);
  });

  it('undo works', () => {
    const prevUState = uState;
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
          payload: 6,
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
    expect(uState.state.count).toBe(4);

    expect(uState.history.stack).toStrictEqual(prevUState.history.stack);
    expect(uState.effects).toStrictEqual<typeof uState.effects>(
      prevUState.effects.concat([
        {
          type: 'addToCount',
          payload: 3,
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

  it('ignores relative update that leads to referentially equal state', () => {
    const prevUState = uState;
    uState = uReducer(uState, {
      type: 'addToCount',
      payload: 0,
    });
    expect(uState.history).toBe(prevUState.history);
    expect(uState.effects).toBe(prevUState.effects);
  });

  it('ignores absolute update that leads to referentially equal state', () => {
    const prevUState = uState;
    uState = uReducer(uState, {
      type: 'updateCount',
      payload: prevUState.state.count,
    });
    expect(uState.history).toBe(prevUState.history);
    expect(uState.effects).toBe(prevUState.effects);
  });

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
          type: 'updateCount',
          payload: 33,
        },
      ])
    );
  });
});
