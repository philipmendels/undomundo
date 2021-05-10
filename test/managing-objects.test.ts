import { invert } from 'fp-ts-std/Boolean';
import { when } from 'fp-ts-std/Function';
import { flow } from 'fp-ts/function';
import { filter, map, mapWithIndex } from 'fp-ts/Record';
import { makeCustomUndoableReducer } from '../src';
import { undo } from '../src/action-creators';
import { getDefaultUndoRedoConfigAbsolute } from '../src/helpers';
import {
  UndoRedoConfigByType,
  PayloadConfigUndoRedo,
  StateWithHistory,
} from '../src/types';
import { evolve, merge } from '../src/util';

type Color = 'red' | 'blue';

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
  changeColor: PayloadConfigUndoRedo<Record<ID, Color>>;
  add: CardsPayloadConfig;
  remove: CardsPayloadConfig;
};

type ObjWithId = {
  id: ID;
  [key: string]: unknown;
};

const isIdInSelection = (selection: Record<ID, unknown>) => <
  T extends ObjWithId
>(
  item: T
) => selection[item.id] !== undefined;

const updateSelected = <T extends ObjWithId>(
  selection: Record<ID, unknown>,
  whenTrueFn: (a: T) => T
) => map<T, T>(when(isIdInSelection(selection))(whenTrueFn));

const updatePropOfSelected = <T extends ObjWithId>(
  selection: Record<ID, unknown>,
  prop: keyof T
) =>
  updateSelected<T>(selection, obj => ({ ...obj, [prop]: selection[obj.id] }));

const configs: UndoRedoConfigByType<State, PBT> = {
  changeColor: getDefaultUndoRedoConfigAbsolute(
    state =>
      mapWithIndex((id, color) =>
        state.cards[id] ? state.cards[id].color : color
      ),
    payload =>
      evolve({
        cards: updatePropOfSelected(payload, 'color'),
      })
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

const { changeColor, remove } = actionCreators;

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

  it('update works', () => {
    uState = uReducer(uState, changeColor({ a: 'blue', c: 'blue' }));

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
  });

  it('undo works', () => {
    uState = uReducer(uState, undo());
    expect(uState.state.cards).toStrictEqual(s1);

    uState = uReducer(uState, undo());
    expect(uState.state.cards).toStrictEqual(s0);
  });
});
