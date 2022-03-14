import {
  makeUndoableReducer,
  redo,
  switchToBranch,
  timeTravel,
  undo,
} from '../src';
import { initHistory } from '../src/helpers';
import { getBranchActions } from '../src/internal';
import { AbsolutePayloadConfig, UReducerAction } from '../src/types/main';
import { merge } from '../src/util';

type State = {
  count: number;
};

type PBT = {
  updateCount: AbsolutePayloadConfig<number>;
};

let history = initHistory<PBT>();
let state: State = { count: 2 };

const {
  uReducer,
  stateReducer,
  historyReducer,
  actionCreators,
  getActionFromStateUpdate,
} = makeUndoableReducer<State, PBT>({
  options: { useBranchingHistory: true },
  actionConfigs: {
    updateCount: {
      updateState: count => merge({ count }),
      updateHistory: state => () => state.count,
    },
  },
});

const { updateCount } = actionCreators;

const expectEqual = (action: UReducerAction<PBT>) => {
  const uState = uReducer(
    { state, history, stateUpdates: [], historyUpdates: [] },
    action
  );
  history = uState.historyUpdates.reduce(historyReducer, history);
  state = uState.stateUpdates
    .filter(update => !update.skipState)
    .map(getActionFromStateUpdate({ isSynchronizing: true }))
    .reduce(stateReducer, state);
  expect(Object.values(history.branches).map(getBranchActions)).toStrictEqual(
    Object.values(uState.history.branches).map(getBranchActions)
  );
  expect(state).toStrictEqual(uState.state);
};

describe('history updates', () => {
  it('works', () => {
    expectEqual(updateCount(4));
    expectEqual(updateCount(8));
    expectEqual(undo());
    expectEqual(undo());
    expectEqual(undo()); // noop:
    expectEqual(redo());
    expectEqual(updateCount(10)); // new branch
    expectEqual(updateCount(12));
    expectEqual(timeTravel(0, Object.keys(history.branches)[0]));
    expectEqual(
      switchToBranch(Object.keys(history.branches)[1], 'HEAD_OF_BRANCH')
    );
    state = stateReducer(state, { type: 'updateCount', payload: 999 }); // external update
    expect(state).toStrictEqual({ count: 999 });
    expectEqual(undo());
    expectEqual(redo());
    expectEqual(updateCount(333, { skipHistory: true }));
  });
});
