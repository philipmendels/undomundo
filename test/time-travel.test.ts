import { negate } from 'fp-ts-std/Number';
import { makeRelativeActionConfig } from '../src/helpers';
import { createInitialHistory, getBranchActions } from '../src/internal';
import {
  makeUndoableState,
  MakeUndoableStateProps,
} from '../src/make-undoable-state';
import { RelativePayloadConfig, UState } from '../src/types/main';
import { add, evolve } from '../src/util';

type State = {
  count: number;
};

type PBT = {
  addToCount: RelativePayloadConfig<number>;
};

let newUState: UState<State, PBT> = {
  effects: [],
  history: createInitialHistory(),
  state: {
    count: 2,
  },
};

const props: MakeUndoableStateProps<State, PBT> = {
  initialUState: newUState,
  actionConfigs: {
    addToCount: makeRelativeActionConfig({
      makeActionForUndo: evolve({ payload: negate }),
      updateState: amount => evolve({ count: add(amount) }),
    }),
  },
  options: {
    useBranchingHistory: true,
  },
};

describe('timeTravel', () => {
  it('works for currentBranch', () => {
    const { undoables, timeTravel } = makeUndoableState(props);

    const { addToCount } = undoables;

    addToCount(2);
    addToCount(3);
    newUState = addToCount(5);

    expect(newUState.history.currentIndex).toBe(2);
    // no change for same index
    expect(timeTravel(2)).toBe(newUState);

    expect(() => timeTravel(3)).toThrow();
    expect(() => timeTravel(-2)).toThrow();

    newUState = timeTravel(0);
    expect(newUState.history.currentIndex).toBe(0);
    expect(newUState.state.count).toBe(4);

    newUState = timeTravel(-1);
    expect(newUState.history.currentIndex).toBe(-1);
    expect(newUState.state.count).toBe(2);

    newUState = timeTravel(1);
    expect(newUState.history.currentIndex).toBe(1);
    expect(newUState.state.count).toBe(7);

    newUState = timeTravel(2);
    expect(newUState.history.currentIndex).toBe(2);
    expect(newUState.state.count).toBe(12);
  });

  it('works for another branch', () => {
    const { undoables, timeTravel, undo } = makeUndoableState(props);

    const { addToCount } = undoables;

    newUState = addToCount(2);
    newUState = addToCount(3);
    const branch1Id = newUState.history.currentBranchId;
    undo();
    newUState = addToCount(5);
    newUState = addToCount(7);
    const branch2Id = newUState.history.currentBranchId;
    undo();
    newUState = addToCount(11);
    newUState = addToCount(13);
    const branch3Id = newUState.history.currentBranchId;

    expect(
      getBranchActions(newUState.history.branches[branch1Id]).map(
        action => action.payload
      )
    ).toStrictEqual<number[]>([3]);

    expect(
      getBranchActions(newUState.history.branches[branch2Id]).map(
        action => action.payload
      )
    ).toStrictEqual<number[]>([7]);

    expect(
      getBranchActions(newUState.history.branches[branch3Id]).map(
        action => action.payload
      )
    ).toStrictEqual<number[]>([2, 5, 11, 13]);

    expect(newUState.history.currentBranchId).toBe(branch3Id);
    expect(newUState.state.count).toBe(33);

    // use the local index for the current history state: b1 index 0 = payload 3
    newUState = timeTravel(0, branch1Id);

    expect(
      getBranchActions(newUState.history.branches[branch1Id]).map(
        action => action.payload
      )
    ).toStrictEqual<number[]>([2, 3]);

    expect(
      getBranchActions(newUState.history.branches[branch2Id]).map(
        action => action.payload
      )
    ).toStrictEqual<number[]>([7]);

    expect(
      getBranchActions(newUState.history.branches[branch3Id]).map(
        action => action.payload
      )
    ).toStrictEqual<number[]>([5, 11, 13]);

    expect(newUState.history.currentBranchId).toBe(branch1Id);
    expect(newUState.state.count).toBe(7);

    newUState = timeTravel(0, branch2Id);

    expect(
      getBranchActions(newUState.history.branches[branch1Id]).map(
        action => action.payload
      )
    ).toStrictEqual<number[]>([3]);

    expect(
      getBranchActions(newUState.history.branches[branch2Id]).map(
        action => action.payload
      )
    ).toStrictEqual<number[]>([2, 5, 7]);

    expect(
      getBranchActions(newUState.history.branches[branch3Id]).map(
        action => action.payload
      )
    ).toStrictEqual<number[]>([11, 13]);

    expect(newUState.history.currentBranchId).toBe(branch2Id);
    expect(newUState.state.count).toBe(16);

    newUState = timeTravel(1, branch3Id);

    expect(
      getBranchActions(newUState.history.branches[branch1Id]).map(
        action => action.payload
      )
    ).toStrictEqual<number[]>([3]);

    expect(
      getBranchActions(newUState.history.branches[branch2Id]).map(
        action => action.payload
      )
    ).toStrictEqual<number[]>([7]);

    expect(
      getBranchActions(newUState.history.branches[branch3Id]).map(
        action => action.payload
      )
    ).toStrictEqual<number[]>([2, 5, 11, 13]);

    expect(newUState.history.currentBranchId).toBe(branch3Id);
    expect(newUState.state.count).toBe(33);
  });
});

describe('switchToBranch', () => {
  it('works', () => {
    const { undoables, switchToBranch, timeTravel, undo } = makeUndoableState(
      props
    );

    const { addToCount } = undoables;

    newUState = addToCount(2);
    newUState = addToCount(3);
    const branch1Id = newUState.history.currentBranchId;
    undo();
    newUState = addToCount(5);
    newUState = addToCount(7);
    const branch2Id = newUState.history.currentBranchId;
    undo();
    newUState = addToCount(11);
    newUState = addToCount(13);
    const branch3Id = newUState.history.currentBranchId;

    expect(newUState.history.currentBranchId).toBe(branch3Id);
    expect(newUState.state.count).toBe(33);

    // defaults to 'LAST_COMMON_ACTION_IF_PAST', which will be the action on index 0
    newUState = switchToBranch(branch1Id);
    expect(
      getBranchActions(newUState.history.branches[branch1Id]).map(
        action => action.payload
      )
    ).toStrictEqual<number[]>([2, 3]);

    expect(newUState.history.currentBranchId).toBe(branch1Id);
    expect(newUState.history.currentIndex).toBe(0);
    expect(newUState.state.count).toBe(4);

    newUState = switchToBranch(branch3Id, 'HEAD_OF_BRANCH');
    expect(newUState.history.currentBranchId).toBe(branch3Id);
    expect(newUState.history.currentIndex).toBe(3);
    expect(newUState.state.count).toBe(33);

    // undo to index 2
    newUState = undo();
    expect(newUState.history.currentIndex).toBe(2);

    newUState = switchToBranch(branch2Id, 'LAST_COMMON_ACTION');
    expect(newUState.history.branches[branch3Id].lastGlobalIndex).toBe(2);
    expect(newUState.history.currentBranchId).toBe(branch2Id);
    expect(newUState.history.currentIndex).toBe(1);
    expect(newUState.state.count).toBe(9);

    newUState = switchToBranch(branch3Id, 'LAST_KNOWN_POSITION_ON_BRANCH');
    expect(newUState.history.currentBranchId).toBe(branch3Id);
    expect(newUState.history.currentIndex).toBe(2);
    expect(newUState.state.count).toBe(20);

    // go to index 0
    timeTravel(0);
    newUState = switchToBranch(branch2Id, 'LAST_COMMON_ACTION_IF_PAST');
    expect(newUState.history.currentBranchId).toBe(branch2Id);
    expect(newUState.history.currentIndex).toBe(0);
    expect(newUState.state.count).toBe(4);
  });
});
