import { initUState, makeDefaultActionConfig, makeUndoableState } from '../src';
import { getCurrentBranchActions } from '../src/internal';
import { DefaultPayloadConfig } from '../src/types/main';

let a = 3;
const setA = (fn: (prev: number) => number) => {
  a = fn(a);
};

let b = 10;
const setB = (val: number) => {
  b = val;
};

type State = { version: number };

type PBT = {
  updateA: DefaultPayloadConfig<number>;
  updateB: DefaultPayloadConfig<number>;
};

const {
  undoables,
  getCurrentUState,
  undo,
  redo,
  timeTravel,
} = makeUndoableState<State, PBT>({
  initialUState: initUState({ version: 1 }),
  actionConfigs: {
    updateA: makeDefaultActionConfig({
      updateState: value => ({ version }) => {
        setA(() => value);
        // hack to opt out of referential equality check
        return { version: version + 1 };
      },
      getValueFromState: () => a,
      updateHistory: val => _ => val,
    }),
    updateB: makeDefaultActionConfig({
      updateState: value => ({ version }) => {
        setB(value);
        // hack to opt out of referential equality check
        return { version: version + 1 };
      },
      getValueFromState: () => b,
      updateHistory: val => _ => val,
    }),
  },
});

const { updateA, updateB } = undoables;

describe('effects', () => {
  it('update works', () => {
    updateA(4);
    console.log(getCurrentBranchActions(getCurrentUState().history));
    expect(a).toBe(4);
  });

  it('undo works', () => {
    undo();
    expect(a).toBe(3);
  });

  it('redo works', () => {
    // external update:
    a = 9;
    redo();
    expect(a).toBe(4);

    updateB(15);
    expect(b).toBe(15);

    // external update:
    b = 20;
  });

  it('undo works after external update', () => {
    undo();
    undo();
    expect(a).toBe(9);
  });

  it('time travel works after external update', () => {
    timeTravel(1);
    expect(b).toBe(20);
  });
});
