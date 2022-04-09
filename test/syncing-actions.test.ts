import { negate } from 'fp-ts-std/Number';
import { v4 } from 'uuid';
import { makeUndoableReducer } from '../src';
import { redo, undo } from '../src/action-creators';
import { getAction, initUState } from '../src/helpers';
import {
  ActionConfigByType,
  AbsolutePayloadConfig,
  CustomPayloadConfig,
  StateUpdate,
  PayloadConfigByType,
  SyncActionUnion,
} from '../src/types/main';
import { add, evolve, merge } from '../src/util';

type State = {
  count: number;
};

type PBT = {
  updateCount: AbsolutePayloadConfig<number>;
  addToCount: CustomPayloadConfig<number>;
  multiplyCount: CustomPayloadConfig<number>;
};

// TODO: add test for syncing updateStateOnUndo

const actionConfigs: ActionConfigByType<State, PBT> = {
  addToCount: {
    makeActionForUndo: evolve({ payload: negate }),
    updateState: amount => evolve({ count: add(amount) }),
  },
  multiplyCount: {
    makeActionForUndo: evolve({ payload: p => 1 / p }),
    updateState: amount => evolve({ count: prev => prev * amount }),
  },
  updateCount: {
    updateState: count => merge({ count }),
    updateHistory: state => () => state.count,
  },
};

interface Batch<PBT extends PayloadConfigByType> {
  id: string;
  updates: StateUpdate<PBT>[];
}

interface ServerBatch<PBT extends PayloadConfigByType> {
  batch: Batch<PBT>;
  parentId?: string;
}

const createClient = () => {
  let uState = initUState<State, PBT>({
    count: 0,
  });

  const { uReducer, actionCreators } = makeUndoableReducer<State, PBT>({
    actionConfigs,
  });

  const log: Batch<PBT>[] = [];

  const { addToCount, updateCount, multiplyCount } = actionCreators;

  const push = (actions: SyncActionUnion<PBT>[]) => {
    uState = actions.reduce(uReducer, uState);
  };

  return {
    getCurrentState: () => uState,
    pushUpdate: (serverBatch: ServerBatch<PBT>) => {
      const { batch } = serverBatch;
      if (!log.length || log[log.length - 1].id === serverBatch.parentId) {
        log.push(batch);
        push(batch.updates.map(convert));
      } else {
        const idx = !serverBatch.parentId
          ? -1
          : log.findIndex(batch => batch.id === serverBatch.parentId);
        if (serverBatch.parentId && idx === -1) {
          throw Error(
            'client received update out of sync, parent is not yet here'
          );
        }
        const toRevert = log.splice(idx + 1);
        push(
          toRevert
            .flatMap(batch => batch.updates)
            .reverse()
            .map(revert)
        );
        log.push(batch);
        push(batch.updates.map(convert));
        log.push(...toRevert);
        push(toRevert.flatMap(batch => batch.updates).map(convert));
      }
    },
    pullUpdate: () => {
      const updates = uState.stateUpdates;
      if (updates.length) {
        const batch: Batch<PBT> = {
          updates,
          id: v4(),
        };
        log.push(batch);
        return batch;
      }
      return null;
    },
    push,
    pull: () => {
      return uState.stateUpdates;
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

const convert = getAction(actionConfigs)({ isSynchronizing: true });
const revert = getAction(actionConfigs)({
  isSynchronizing: true,
  invertAction: true,
});

describe('syncing actions without conflicts', () => {
  const client1 = createClient();
  const client2 = createClient();
  const sync1to2 = () => client2.push(client1.pull().map(convert));
  const sync2to1 = () => client1.push(client2.pull().map(convert));

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
    // it only works if all the payloads of the out-of-sync actions are absolute and
    // if a client does not create a new action before receiving the confirmation.

    client1.push(effects2.map(convert)); // sync
    client2.push(effects2.map(convert)); // confirmation

    client1.push(effects1.map(convert)); // confirmation
    client2.push(effects1.map(convert)); // sync

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

    client1.push(effects2.map(convert)); // sync

    // Client 2 is out-of-sync. The actions in client 2 that are out-of-sync
    // need to be reverted, then the actions of client 1 need to be synced to
    // client 2, and then the actions of client 2 need to be re-applied.
    //
    // The next line reverts the last action correctly but leads to the wrong undo-history:
    // client2.undo().
    //
    // Instead let's revert the actions manually.
    client2.push(effects2.map(revert));

    s2 = client2.getCurrentState();

    expect(s2.state.count).toEqual(3);

    client2.push(effects1.map(convert)); // sync
    client2.push(effects2.map(convert)); // re-apply

    s1 = client1.getCurrentState();
    s2 = client2.getCurrentState();
    expect(s1.state.count).toEqual(15);
    expect(s2.state.count).toEqual(15);

    // Should the actions that were reverted be removed from the undo history
    // of client 2? Probably not because they did happen, even though their result
    // was perhaps only visible for a very short while.

    client1.undo(); // + -2
    client2.undo(); // * 1/3
    s1 = client1.getCurrentState();
    s2 = client2.getCurrentState();
    // Results are conceptually strange but technically correct due to the relative payloads.
    expect(s1.state.count).toEqual(13);
    expect(s2.state.count).toEqual(5);
  });
});

describe('syncing using client log', () => {
  const client1 = createClient();
  const client2 = createClient();

  client1.updateCount(3);
  const update1 = client1.pullUpdate()!;

  client2.updateCount(5);
  const update2 = client2.pullUpdate()!;

  const serverLog: Batch<PBT>[] = [];

  serverLog.push(update1);
  client2.pushUpdate({ batch: update1 });

  const parentId = serverLog[serverLog.length - 1].id;
  serverLog.push(update2);
  client1.pushUpdate({ batch: update2, parentId });

  expect(client1.getCurrentState().state.count).toEqual(5);
  expect(client2.getCurrentState().state.count).toEqual(5);
});
