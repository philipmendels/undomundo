import { negate } from 'fp-ts-std/Number';
import { identity } from 'fp-ts/function';
import {
  AbsolutePayloadConfig,
  initHistory,
  RelativePayloadConfig,
} from '../src';
import { makeUndoableEffects } from '../src/make-undoable-effects';
import { add, evolve, merge, subtract } from '../src/util';

type State = {
  count: number;
};

type PBT = {
  updateCount: AbsolutePayloadConfig<number>;
  addToCount: RelativePayloadConfig<number>;
  addToCount_alt: RelativePayloadConfig<number>;
};

let state: State = {
  count: 3,
};

const setState = (updater: (prev: State) => State) => {
  state = updater(state);
};

let history = initHistory<PBT>();

const { undoables, undo, redo, getCurrentHistory } = makeUndoableEffects<PBT>({
  initialHistory: history,
  actionConfigs: {
    updateCount: { updateState: count => setState(merge({ count })) },
    addToCount: {
      updateState: amount => setState(evolve({ count: add(amount) })),
      // payload conversion for undo:
      makeActionForUndo: evolve({ payload: negate }),
    },
    addToCount_alt: {
      updateState: amount => setState(evolve({ count: add(amount) })),
      makeActionForUndo: identity,
      // separate updater for undo
      updateStateOnUndo: amount =>
        setState(evolve({ count: subtract(amount) })),
    },
  },
});

const { addToCount, addToCount_alt, updateCount } = undoables;

const expectGetCurrentHistoryEquals = () =>
  expect(history).toBe(getCurrentHistory());

describe('effects', () => {
  it('update works', () => {
    expect(state.count).toBe(3);

    history = updateCount(state.count, 5);
    expect(state.count).toBe(5);
    expectGetCurrentHistoryEquals();

    history = addToCount(5);
    expect(state.count).toBe(10);
    expectGetCurrentHistoryEquals();

    history = addToCount_alt(8);
    expect(state.count).toBe(18);
    expectGetCurrentHistoryEquals();
  });

  it('undo works', () => {
    history = undo();
    expect(state.count).toBe(10);
    expectGetCurrentHistoryEquals();

    history = undo();
    expect(state.count).toBe(5);
    expectGetCurrentHistoryEquals();

    history = undo();
    expect(state.count).toBe(3);
    expectGetCurrentHistoryEquals();
  });

  it('red works', () => {
    history = redo();
    expect(state.count).toBe(5);
    expectGetCurrentHistoryEquals();

    history = redo();
    expect(state.count).toBe(10);
    expectGetCurrentHistoryEquals();

    history = redo();
    expect(state.count).toBe(18);
    expectGetCurrentHistoryEquals();
  });
});
