import { ActionUnion, StateWithHistory, ValueByType } from '../src/types';
import { State, PBT, uReducer } from './shared';

const createClient = () => {
  let stateWithHist: StateWithHistory<State, PBT> = {
    effects: [],
    history: {
      stack: [],
      index: -1,
    },
    state: {
      count: 0,
    },
  };
  return {
    inspect: () => stateWithHist,
    push: (actions: ActionUnion<ValueByType<PBT>>[]) => {
      actions.forEach(action => {
        stateWithHist = uReducer(stateWithHist, {
          ...action,
          meta: { skipAddToHist: true },
        });
      });
    },
    pull: () => {
      const actions = stateWithHist.effects;
      stateWithHist = {
        ...stateWithHist,
        effects: [],
      };
      return actions;
    },
    updateCount: (count: number) => {
      stateWithHist = uReducer(stateWithHist, {
        type: 'updateCount',
        payload: count,
      });
    },
    add: (amount: number) => {
      stateWithHist = uReducer(stateWithHist, {
        type: 'add',
        payload: amount,
      });
    },
    undo: () => {
      stateWithHist = uReducer(stateWithHist, { type: 'undo' });
    },
    redo: () => {
      stateWithHist = uReducer(stateWithHist, { type: 'redo' });
    },
  };
};

describe('external updates', () => {
  const client1 = createClient();
  const client2 = createClient();
  const sync1to2 = () => client2.push(client1.pull());
  it('standard update works', () => {
    client1.add(3);
    const s1 = client1.inspect();
    expect(s1.state.count).toEqual(3);
    sync1to2();
    const s2 = client2.inspect();
    expect(s1.state).toEqual(s2.state);
    expect(s1.history).not.toEqual(s2.history);
  });
  it('undo update works', () => {
    client1.undo();
    const s1 = client1.inspect();
    expect(s1.state.count).toEqual(0);
    sync1to2();
    const s2 = client2.inspect();
    expect(s1.state).toEqual(s2.state);
    expect(s1.history).not.toEqual(s2.history);
  });
});

// Very basic implementation, without optimization / anti-flicker.
// Updates are always applied twice due to confirmation step, therefore
// it only works for absolute payloads (not for deltas).
describe('last write wins', () => {
  const client1 = createClient();
  const client2 = createClient();
  let serverHist: ActionUnion<ValueByType<PBT>>[] = [];
  it('works as expected', () => {
    client1.updateCount(3);
    let s1 = client1.inspect();
    expect(s1.state.count).toEqual(3);
    const effects1 = client1.pull();

    client2.updateCount(7);
    let s2 = client2.inspect();
    expect(s2.state.count).toEqual(7);
    const effects2 = client2.pull();

    serverHist = [...serverHist, ...effects2];
    client1.push(effects2); // sync
    client2.push(effects2); // confirmation

    serverHist = [...serverHist, ...effects1];
    client1.push(effects1); // confirmation
    client2.push(effects1); // sync

    s1 = client1.inspect();
    s2 = client2.inspect();
    expect(s1.state.count).toEqual(3);
    expect(s2.state.count).toEqual(3);
  });
});
