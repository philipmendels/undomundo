import { invert } from 'fp-ts-std/Boolean';
import { when } from 'fp-ts-std/Function';
import { flow, pipe } from 'fp-ts/function';
import { filter, map, mapWithIndex } from 'fp-ts/Record';
import { makeCustomUndoableReducer } from '../src';
import { redo, undo } from '../src/action-creators';
import { getDefaultUndoRedoConfigAbsolute } from '../src/helpers';
import {
  UndoRedoConfigByType,
  PayloadConfigUndoRedo,
  StateWithHistory,
} from '../src/types';
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

type CardsPayloadConfig = {
  original: Record<ID, Card>;
};

type PBT = {
  setColor: PayloadConfigUndoRedo<Record<ID, Color>>;
  add: CardsPayloadConfig;
  remove: CardsPayloadConfig;
  set: PayloadConfigUndoRedo<Record<ID, Card | null>>;
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

const configs: UndoRedoConfigByType<State, PBT> = {
  setColor: getDefaultUndoRedoConfigAbsolute(
    state =>
      mapWithIndex((id, color) =>
        state.cards[id] ? state.cards[id].color : color
      ),
    payload =>
      evolve({
        cards: mapPayloadToProp(payload, 'color'),
      })
  ),
  set: getDefaultUndoRedoConfigAbsolute(
    state =>
      mapWithIndex(id =>
        state.cards[id] === undefined ? null : state.cards[id]
      ),
    payload => {
      const { removed, updated } = splitPayload(payload);
      return evolve({
        cards: flow(
          filter(flow(isIdInSelection(removed), invert)),
          merge(updated)
        ),
      });
    }
  ),
  add: {
    updateState: payload => evolve({ cards: merge(payload) }),
    undo: ({ payload }) => ({ type: 'remove', payload }),
  },
  remove: {
    updateState: payload =>
      evolve({ cards: filter(flow(isIdInSelection(payload), invert)) }),
    undo: ({ payload }) => ({ type: 'add', payload }),
  },
};

const { uReducer, actionCreators } = makeCustomUndoableReducer(configs);

const { setColor, add, remove, set } = actionCreators;

let uState: StateWithHistory<State, PBT> = {
  effects: [],
  history: {
    stack: [],
    index: -1,
  },
  state: {
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
  },
};

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
