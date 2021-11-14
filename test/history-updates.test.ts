import {
  makeUndoableReducer,
  redo,
  switchToBranch,
  timeTravel,
  undo,
} from '../src';
import { makeDefaultActionConfig, initHistory } from '../src/helpers';
import { getBranchActions } from '../src/internal';
import { DefaultPayloadConfig, UReducerAction } from '../src/types/main';
import { merge } from '../src/util';

type State = {
  count: number;
};

type PBT = {
  updateCount: DefaultPayloadConfig<number>;
};

let history = initHistory<PBT>();
let state: State = { count: 2 };

const {
  uReducer,
  stateReducer,
  historyReducer,
  actionCreators,
} = makeUndoableReducer<State, PBT>({
  options: { useBranchingHistory: true },
  actionConfigs: {
    updateCount: makeDefaultActionConfig({
      updateState: count => merge({ count }),
      getValueFromState: state => state.count,
      updateHistory: count => _ => count,
    }),
  },
});

const { updateCount } = actionCreators;

const expectEqual = (action: UReducerAction<PBT>) => {
  let uState = uReducer({ state, history, output: [], updates: [] }, action);
  history = uState.updates.reduce(historyReducer, history);
  state = uState.output.reduce(stateReducer, state);
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
    expectEqual(updateCount(12)); // new branch
    expectEqual(updateCount(10));
    expectEqual(timeTravel(0, Object.keys(history.branches)[0]));
    expectEqual(
      switchToBranch(Object.keys(history.branches)[1], 'HEAD_OF_BRANCH')
    );
  });
});
