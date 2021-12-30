import { invert } from 'fp-ts-std/Boolean';
import { when } from 'fp-ts-std/Function';
import { flow, pipe } from 'fp-ts/function';
import { filter, map, mapWithIndex } from 'fp-ts/Record';
import { makeUndoableReducer } from '../src';
import { redo, undo } from '../src/action-creators';
import { initUState } from '../src/helpers';
import {
  ActionConfigByType,
  AbsolutePayloadConfig,
  RelativePayloadConfig,
} from '../src/types/main';
import { evolve, merge } from '../src/util';

type Color = 'red' | 'green' | 'blue';

type ID = string;

type Card = {
  id: ID;
  color: Color;
};

type State = {
  cards: Record<ID, Card>;
};

type CardsPayloadConfig = RelativePayloadConfig<Record<ID, Card | null>>;

type PBT = {
  setColor: AbsolutePayloadConfig<Record<ID, Color>>;
  add: CardsPayloadConfig;
  remove: CardsPayloadConfig;
  set: AbsolutePayloadConfig<Record<ID, Card | null>>;
};

type ObjWithId = {
  id: ID;
  [key: string]: unknown;
};

const isIdInSelection = (selection: Record<ID, unknown>) => <
  T extends ObjWithId
>(
  item: T
) => selection.hasOwnProperty(item.id);

const updateSelected = <T extends ObjWithId>(
  selection: Record<ID, unknown>,
  whenTrueFn: (a: T) => T
) => map<T, T>(when(isIdInSelection(selection))(whenTrueFn));

const mapPayloadToProp = <T extends ObjWithId, K extends keyof T>(
  payload: Record<ID, T[K]>,
  prop: K
) => updateSelected<T>(payload, obj => ({ ...obj, [prop]: payload[obj.id] }));

const splitPayload = (payload: Record<ID, Card | null>) => ({
  removed: pipe(
    payload,
    filter(item => item === null)
  ),
  updated: pipe(
    payload,
    filter(item => item !== null)
  ) as Record<ID, Card>,
});

const actionConfigs: ActionConfigByType<State, PBT> = {
  setColor: {
    updateState: payload =>
      evolve({
        cards: mapPayloadToProp(payload, 'color'),
      }),
    updateHistory: state =>
      mapWithIndex((id, color) => state.cards[id]?.color ?? color),
  },
  // 'set' is a combination of add/remove as a single absolute action. Depending
  // on the implementation is may differ from separate relative add/remove actions
  // because it does not allow for the updateState (and updateHistory) logic to differ
  // between undo and redo.
  //
  // Also in contrast to the relative actions, updateHistory will also be used for
  // initializing the undo value in the history.
  set: {
    updateState: payload => {
      const { removed, updated } = splitPayload(payload);
      return evolve({
        cards: flow(
          filter(flow(isIdInSelection(removed), invert)),
          merge(updated)
        ),
      });
    },
    updateHistory: state => mapWithIndex(id => state.cards[id] ?? null),
  },
  add: {
    // Redo should result in the same state as before undo (and vice versa). So when
    // another user has removed the object that you added you should not be able to
    // re-add it by means of undo and then redo. Hence the update to null.
    updateHistory: state => mapWithIndex(id => state.cards[id] ?? null),
    updateState: payload =>
      evolve({
        cards: merge(
          filter(item => item !== null)(payload) as Record<string, Card>
        ),
      }),
    makeActionForUndo: ({ payload }) => ({ type: 'remove', payload }),
  },
  remove: {
    // When undoing a remove, the object is never in state (it is impossible for another
    // user to add the object that you removed) so updating the history does not make sense.
    // When redoing a remove, the object may NOT be in state because it may be removed
    // by the other user. If that is the case, then the value SHOULD become null otherwise
    // you can wrongly re-add the object by means of redo and then undo.
    //
    // This may imply that separate history updaters are needed for undo and redo, but
    // in practice it does not seemt to matter which value you set the history to on undo
    // because the value will be updated again on redo.
    updateHistory: state => mapWithIndex(id => state.cards[id] ?? null),
    updateState: payload =>
      evolve({ cards: filter(flow(isIdInSelection(payload), invert)) }),
    makeActionForUndo: ({ payload }) => ({ type: 'add', payload }),
  },
};

const { uReducer, actionCreators } = makeUndoableReducer({ actionConfigs });

const { setColor, add, remove, set } = actionCreators;

let uState = initUState<State, PBT>({
  cards: {
    a: {
      id: 'a',
      color: 'red',
    },
    b: {
      id: 'b',
      color: 'red',
    },
    c: {
      id: 'c',
      color: 'red',
    },
  },
});

describe('multi-select', () => {
  const s0 = uState.state.cards;
  const s1: Record<ID, Card> = {
    a: {
      id: 'a',
      color: 'blue',
    },
    b: {
      id: 'b',
      color: 'red',
    },
    c: {
      id: 'c',
      color: 'blue',
    },
  };

  const s2: Record<ID, Card> = {
    c: {
      id: 'c',
      color: 'blue',
    },
  };

  const s3: Record<ID, Card> = {
    c: {
      id: 'c',
      color: 'blue',
    },
    d: {
      id: 'd',
      color: 'green',
    },
    e: {
      id: 'e',
      color: 'red',
    },
  };

  it('update works', () => {
    uState = uReducer(uState, setColor({ a: 'blue', c: 'blue' }));

    expect(uState.state.cards).toStrictEqual(s1);

    uState = uReducer(
      uState,
      remove({
        a: {
          id: 'a',
          color: 'blue',
        },
        b: {
          id: 'b',
          color: 'red',
        },
      })
    );

    expect(uState.state.cards).toStrictEqual(s2);

    uState = uReducer(
      uState,
      add({
        d: {
          id: 'd',
          color: 'green',
        },
        e: {
          id: 'e',
          color: 'red',
        },
      })
    );

    expect(uState.state.cards).toStrictEqual(s3);
  });

  it('undo works', () => {
    uState = uReducer(uState, undo());
    expect(uState.state.cards).toStrictEqual(s2);

    uState = uReducer(uState, undo());
    expect(uState.state.cards).toStrictEqual(s1);

    uState = uReducer(uState, undo());
    expect(uState.state.cards).toStrictEqual(s0);
  });

  it('redo works', () => {
    uState = uReducer(uState, redo());
    expect(uState.state.cards).toStrictEqual(s1);

    uState = uReducer(uState, redo());
    expect(uState.state.cards).toStrictEqual(s2);

    uState = uReducer(uState, redo());
    expect(uState.state.cards).toStrictEqual(s3);
  });

  it('set works', () => {
    uState = uReducer(uState, undo());
    uState = uReducer(uState, undo());
    uState = uReducer(
      uState,
      set({
        a: null,
        b: null,
      })
    );

    expect(uState.state.cards).toStrictEqual(s2);

    uState = uReducer(
      uState,
      set({
        d: {
          id: 'd',
          color: 'green',
        },
        e: {
          id: 'e',
          color: 'red',
        },
      })
    );

    expect(uState.state.cards).toStrictEqual(s3);
  });
});
