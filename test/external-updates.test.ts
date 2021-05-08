import { negate } from 'fp-ts-std/Number';
import { makeCustomUndoableReducer } from '../src';
import { redo, undo } from '../src/action-creators';
import { getDefaultUndoRedoConfigAbsolute } from '../src/helpers';
import {
  ActionUnion,
  StateWithHistory,
  PayloadOriginalByType,
  UndoRedoConfigByType,
  PayloadConfigUndoRedo,
  undoConfigAsRelative,
} from '../src/types';
import { add, evolve, merge } from '../src/util';
import { State } from './shared';

type PBT = {
  updateCount: PayloadConfigUndoRedo<number>;
  addToCount: {
    original: number;
  };
  multiplyCount: {
    original: number;
  };
};

const configs: UndoRedoConfigByType<State, PBT> = {
  addToCount: {
    undo: evolve({ payload: negate }),
    updateState: amount => evolve({ count: add(amount) }),
  },
  multiplyCount: {
    undo: evolve({ payload: p => 1 / p }),
    updateState: amount => evolve({ count: prev => prev * amount }),
  },
  updateCount: getDefaultUndoRedoConfigAbsolute(
    state => _ => state.count,
    count => merge({ count })
  ),
};

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

  const { uReducer, actionCreators } = makeCustomUndoableReducer<State, PBT>(
    configs
  );

  const { addToCount, updateCount, multiplyCount } = actionCreators;

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
    multiplyCount: (amount: number) => {
      uState = uReducer(uState, multiplyCount(amount));
    },
    undo: () => {
      uState = uReducer(uState, undo());
    },
    redo: () => {
      uState = uReducer(uState, redo());
    },
  };
};

describe('syncing actions without conflicts', () => {
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

describe('syncing actions with conflicts ', () => {
  const client1 = createClient();
  const client2 = createClient();
  let serverHist: ActionUnion<PayloadOriginalByType<PBT>>[] = [];

  it('conflicts are resolved for all-absolute payloads', () => {
    client1.updateCount(3);
    let s1 = client1.getCurrentState();
    expect(s1.state.count).toEqual(3);
    const effects1 = client1.pull();

    client2.updateCount(7);
    let s2 = client2.getCurrentState();
    expect(s2.state.count).toEqual(7);
    const effects2 = client2.pull();

    // Very basic implementation without the need to revert out-of-sync actions.
    // Actions are always applied twice due to confirmation step, therefore
    // it only works if all the payloads of the out-of-sync actions are absolute.

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

  it('conflicts are resolved for relative payloads', () => {
    client1.addToCount(2);
    let s1 = client1.getCurrentState();
    expect(s1.state.count).toEqual(5);
    const effects1 = client1.pull();

    client2.multiplyCount(3);
    let s2 = client2.getCurrentState();
    expect(s2.state.count).toEqual(9);
    const effects2 = client2.pull();

    serverHist = [...serverHist, ...effects1];
    serverHist = [...serverHist, ...effects2];

    client1.push(effects2); // sync

    // Client 2 is out-of-sync. The actions in client 2 that are out-of-sync
    // need to be reverted, then the actions of client 1 need to be synced to
    // client 2, and then the actions of client 2 need to be re-applied.
    //
    // The next line reverts the last action correctly but leads to the wrong undo-history:
    // client2.undo().
    //
    // Instead let's revert the actions manually. In this crude example we can only revert
    // the relative actions because we are mapping over the effects (which lack the
    // the absolute undo-redo payloads). Normally this should happen on the client and
    // there we should probably map over the actions in the undo history which do have
    // the absolute payloads.
    client2.push(
      effects2.map(({ type, payload }) =>
        undoConfigAsRelative<PBT>(configs[type]).undo({ type, payload })
      )
    );

    s2 = client2.getCurrentState();

    expect(s2.state.count).toEqual(3);

    // Should the actions that were reverted be removed from the undo history
    // of client 2? Probably not because they did happen, even though their result
    // was perhaps only visible for a very short while.

    client2.push(effects1); // sync
    client2.push(effects2); // re-apply

    s1 = client1.getCurrentState();
    s2 = client2.getCurrentState();
    expect(s1.state.count).toEqual(15);
    expect(s2.state.count).toEqual(15);
  });
});
