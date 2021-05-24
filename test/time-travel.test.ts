import { negate } from 'fp-ts-std/Number';
import { makeRelativeActionConfig } from '../src/helpers';
import { createInitialHistory } from '../src/internal';
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
});
