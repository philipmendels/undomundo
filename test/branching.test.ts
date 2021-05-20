import { negate } from 'fp-ts-std/Number';
import { makeRelativeActionConfig } from '../src/helpers';
import {
  createInitialHistory,
  getBranchActions,
  getCurrentBranch,
  getCurrentBranchActions,
} from '../src/internal';
import {
  makeUndoableState,
  MakeUndoableStateProps,
} from '../src/make-undoable-state';
import { ParentConnection, PositionOnBranch } from '../src/types/history';
import {
  OriginalActionUnion,
  RelativePayloadConfig,
  UState,
} from '../src/types/main';
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
};

describe('branching', () => {
  it('future is replaced by default', () => {
    const { undoables, undo } = makeUndoableState(props);

    const { addToCount } = undoables;

    addToCount(2);
    addToCount(3);
    addToCount(5);
    undo();
    newUState = addToCount(7);
    expect(getCurrentBranchActions(newUState.history)).toStrictEqual<
      OriginalActionUnion<PBT>[]
    >([
      {
        type: 'addToCount',
        payload: 2,
      },
      {
        type: 'addToCount',
        payload: 3,
      },
      {
        type: 'addToCount',
        payload: 7,
      },
    ]);
  });

  it('branching option works', () => {
    const { undoables, undo } = makeUndoableState({
      ...props,
      options: { useBranchingHistory: true },
    });

    const prevUState = newUState;

    const { addToCount } = undoables;

    addToCount(2);
    addToCount(3);
    addToCount(5);
    undo();
    expect(Object.keys(newUState.history.branches).length).toBe(1);

    newUState = addToCount(7);

    expect(Object.keys(newUState.history.branches).length).toBe(2);
    expect(newUState.history.currentBranchId).not.toBe(
      prevUState.history.currentBranchId
    );

    const oldBranch =
      newUState.history.branches[prevUState.history.currentBranchId];

    const newBranch = getCurrentBranch(newUState.history);

    expect(getBranchActions(oldBranch)).toStrictEqual<
      OriginalActionUnion<PBT>[]
    >([
      {
        type: 'addToCount',
        payload: 5,
      },
    ]);

    expect(oldBranch.parent).toStrictEqual<ParentConnection>({
      branchId: newBranch.id,
      position: {
        globalIndex: 1,
        actionId: newBranch.stack[1].id,
      },
    });

    expect(oldBranch.lastPosition).toStrictEqual<PositionOnBranch>({
      globalIndex: 1,
      actionId: newBranch.stack[1].id,
    });

    expect(getBranchActions(newBranch)).toStrictEqual<
      OriginalActionUnion<PBT>[]
    >([
      {
        type: 'addToCount',
        payload: 2,
      },
      {
        type: 'addToCount',
        payload: 3,
      },
      {
        type: 'addToCount',
        payload: 7,
      },
    ]);
  });
});
