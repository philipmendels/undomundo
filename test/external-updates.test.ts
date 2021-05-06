import { negate } from 'fp-ts-std/Number';
import { makeCustomUndoableReducer } from '../src';
import { redo, undo } from '../src/action-creators';
import { getDefaultUndoRedoConfigAbsolute } from '../src/helpers';
import {
  ActionUnion,
  StateWithHistory,
  PayloadOriginalByType,
} from '../src/types';
import { add, evolve, merge } from '../src/util';
import { State, PBT } from './shared';

const createClient = () => {
  let uState: StateWithHistory<State, PBT> = {
    effects: [],
    history: {
      stack: [],
      index: -1,
    },
    state: {
      count: 0,
    },
  };
  const { uReducer, actionCreators } = makeCustomUndoableReducer<State, PBT>({
    addToCount: {
      undo: evolve({ payload: negate }),
      updateState: amount => evolve({ count: add(amount) }),
    },
    updateCount: getDefaultUndoRedoConfigAbsolute(
      state => _ => state.count,
      count => merge({ count })
    ),
  });

  const { addToCount, updateCount } = actionCreators;

  return {
    getCurrentState: () => uState,
    push: (actions: ActionUnion<PayloadOriginalByType<PBT>>[]) => {
      actions.forEach(action => {
        uState = uReducer(uState, {
          ...action,
          meta: { skipHistory: true, skipEffects: true },
        });
      });
    },
    pull: () => {
      const actions = uState.effects;
      uState = {
        ...uState,
        effects: [],
      };
      return actions;
    },
    updateCount: (count: number) => {
      uState = uReducer(uState, updateCount(count));
    },
    addToCount: (amount: number) => {
      uState = uReducer(uState, addToCount(amount));
    },
    undo: () => {
      uState = uReducer(uState, undo());
    },
    redo: () => {
      uState = uReducer(uState, redo());
    },
  };
};

describe('effects without conflicts', () => {
  const client1 = createClient();
  const client2 = createClient();
  const sync1to2 = () => client2.push(client1.pull());
  const sync2to1 = () => client1.push(client2.pull());

  it('effect works', () => {
    client1.addToCount(3);
    const s1 = client1.getCurrentState();
    expect(s1.state.count).toBe(3);
    sync1to2();
    const s2 = client2.getCurrentState();
    expect(s2.state).toStrictEqual(s1.state);
    expect(s2.history).not.toEqual(s1.history);
  });

  it('effect works in other direction', () => {
    client2.addToCount(5);
    const s2 = client2.getCurrentState();
    expect(s2.state.count).toBe(8);
    sync2to1();
    const s1 = client1.getCurrentState();
    expect(s1.state).toStrictEqual(s2.state);
    expect(s1.history).not.toEqual(s2.history);
  });

  it('undo effect works', () => {
    client1.undo();
    const s1 = client1.getCurrentState();
    expect(s1.state.count).toBe(5);
    sync1to2();
    const s2 = client2.getCurrentState();
    expect(s2.state).toStrictEqual(s1.state);
    expect(s2.history).not.toEqual(s1.history);
  });

  it('undo effect works in other direction', () => {
    client2.undo();
    const s2 = client2.getCurrentState();
    expect(s2.state.count).toBe(0);
    sync2to1();
    const s1 = client1.getCurrentState();
    expect(s1.state).toStrictEqual(s2.state);
    expect(s1.history).not.toEqual(s2.history);
  });

  it('redo effect works', () => {
    client1.redo();
    const s1 = client1.getCurrentState();
    expect(s1.state.count).toBe(3);
    sync1to2();
    const s2 = client2.getCurrentState();
    expect(s2.state).toStrictEqual(s1.state);
    expect(s2.history).not.toEqual(s1.history);
  });

  it('redo effect works in other direction', () => {
    client2.redo();
    const s2 = client2.getCurrentState();
    expect(s2.state.count).toBe(8);
    sync2to1();
    const s1 = client1.getCurrentState();
    expect(s1.state).toStrictEqual(s2.state);
    expect(s1.history).not.toEqual(s2.history);
  });
});

// Very basic implementation, without optimization / anti-flicker.
// Updates are always applied twice due to confirmation step, therefore
// it only works for absolute payloads (not for deltas).
describe('last write wins', () => {
  const client1 = createClient();
  const client2 = createClient();
  let serverHist: ActionUnion<PayloadOriginalByType<PBT>>[] = [];
  it('works as expected', () => {
    client1.updateCount(3);
    let s1 = client1.getCurrentState();
    expect(s1.state.count).toEqual(3);
    const effects1 = client1.pull();

    client2.updateCount(7);
    let s2 = client2.getCurrentState();
    expect(s2.state.count).toEqual(7);
    const effects2 = client2.pull();

    serverHist = [...serverHist, ...effects2];
    client1.push(effects2); // sync
    client2.push(effects2); // confirmation

    serverHist = [...serverHist, ...effects1];
    client1.push(effects1); // confirmation
    client2.push(effects1); // sync

    s1 = client1.getCurrentState();
    s2 = client2.getCurrentState();
    expect(s1.state.count).toEqual(3);
    expect(s2.state.count).toEqual(3);
  });
});
