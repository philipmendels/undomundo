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

    const prevUState = props.initialUState;

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

  it('maxHistory option works', () => {
    const { undoables } = makeUndoableState({
      ...props,
      options: { maxHistoryLength: 3 },
    });

    const { addToCount } = undoables;

    addToCount(2);
    addToCount(3);
    newUState = addToCount(5);

    expect(getCurrentBranch(newUState.history).stack.length).toBe(3);

    newUState = addToCount(7);

    const currentBranch = getCurrentBranch(newUState.history);

    expect(currentBranch.stack.length).toBe(3);

    expect(getBranchActions(currentBranch)).toStrictEqual<
      OriginalActionUnion<PBT>[]
    >([
      {
        type: 'addToCount',
        payload: 3,
      },
      {
        type: 'addToCount',
        payload: 5,
      },
      {
        type: 'addToCount',
        payload: 7,
      },
    ]);
  });

  it('clearOrphanBranches works in case of clearing the past', () => {
    const { undoables, undo, getCurrentUState } = makeUndoableState({
      ...props,
      options: { maxHistoryLength: 2, useBranchingHistory: true },
    });

    const { addToCount } = undoables;

    let branch1 = getCurrentBranch(getCurrentUState().history);

    addToCount(2);
    addToCount(3);
    undo();
    addToCount(5);
    newUState = addToCount(7);
    branch1 = newUState.history.branches[branch1.id];
    expect(branch1).toBeDefined();
    newUState = addToCount(11);
    branch1 = newUState.history.branches[branch1.id];
    expect(branch1).toBeUndefined();
  });

  it('clearOrphanBranches works in case of clearing the future', () => {
    const { undoables, undo } = makeUndoableState({
      ...props,
      options: { useBranchingHistory: true },
    });

    const { addToCount } = undoables;

    addToCount(2);
    addToCount(3);
    newUState = addToCount(5);
    let branch1 = getCurrentBranch(newUState.history);
    undo();
    newUState = addToCount(7);

    const { undoables: undoables2, undo: undo2 } = makeUndoableState({
      ...props,
      initialUState: newUState,
      options: { maxHistoryLength: 2 },
    });

    undo2();
    newUState = undo2();
    branch1 = newUState.history.branches[branch1.id];
    expect(branch1).toBeDefined();
    newUState = undoables2.addToCount(11);
    branch1 = newUState.history.branches[branch1.id];
    expect(branch1).toBeUndefined();
  });

  it('branching, max-history and clearing orphans works for index 0', () => {
    const { undoables, undo } = makeUndoableState({
      ...props,
      options: { useBranchingHistory: true, maxHistoryLength: 2 },
    });

    const prevUState = props.initialUState;

    const { addToCount } = undoables;

    addToCount(2);
    undo();
    newUState = addToCount(3);

    let branch1 =
      newUState.history.branches[prevUState.history.currentBranchId];

    let branch2 = getCurrentBranch(newUState.history);

    expect(getBranchActions(branch1)).toStrictEqual<OriginalActionUnion<PBT>[]>(
      [
        {
          type: 'addToCount',
          payload: 2,
        },
      ]
    );

    expect(branch1.parent).toStrictEqual<ParentConnection>({
      branchId: branch2.id,
      position: {
        globalIndex: -1,
        actionId: 'start',
      },
    });

    expect(branch1.lastPosition).toStrictEqual<PositionOnBranch>({
      globalIndex: -1,
      actionId: 'start',
    });

    expect(getBranchActions(branch2)).toStrictEqual<OriginalActionUnion<PBT>[]>(
      [
        {
          type: 'addToCount',
          payload: 3,
        },
      ]
    );

    addToCount(5);
    undo();
    newUState = addToCount(7);

    branch1 = newUState.history.branches[branch1.id];
    branch2 = newUState.history.branches[branch2.id];
    let branch3 = getCurrentBranch(newUState.history);

    expect(getBranchActions(branch2)).toStrictEqual<OriginalActionUnion<PBT>[]>(
      [
        {
          type: 'addToCount',
          payload: 5,
        },
      ]
    );

    expect(getBranchActions(branch3)).toStrictEqual<OriginalActionUnion<PBT>[]>(
      [
        {
          type: 'addToCount',
          payload: 3,
        },
        {
          type: 'addToCount',
          payload: 7,
        },
      ]
    );

    expect(branch1.parent).toStrictEqual<ParentConnection>({
      branchId: branch3.id,
      position: {
        globalIndex: -1,
        actionId: 'start',
      },
    });

    expect(branch2.parent).toStrictEqual<ParentConnection>({
      branchId: branch3.id,
      position: {
        globalIndex: 0,
        actionId: branch3.stack[0].id,
      },
    });

    newUState = addToCount(11);

    branch1 = newUState.history.branches[branch1.id];
    branch2 = newUState.history.branches[branch2.id];
    branch3 = newUState.history.branches[branch3.id];

    expect(branch1).toBeUndefined();
    expect(branch2.parent!.branchId).toBe(branch3.id);
    expect(branch2.parent!.position.globalIndex).toBe(-1);

    expect(getBranchActions(branch3)).toStrictEqual<OriginalActionUnion<PBT>[]>(
      [
        {
          type: 'addToCount',
          payload: 7,
        },
        {
          type: 'addToCount',
          payload: 11,
        },
      ]
    );
  });
});
