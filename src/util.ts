import { identity, pipe, Predicate } from 'fp-ts/function';
import { mapWithIndex } from 'fp-ts/Record';
import {
  StringMap,
  OriginalPayloadByType,
  UpdatersByType,
  ActionCreatorsByType,
  ValueOf,
  Endomorphism,
  PayloadConfigByType,
  ReducerOf,
} from './types/main';

export const add = (a: number) => (b: number) => a + b;
export const add1 = add(1);
export const subtract = (a: number) => add(-a);
export const subtract1 = subtract(1);

export const updateArrayAt = <A>(i: number, item: A) =>
  modifyArrayAt(i, () => item);

export const modifyArrayAt = <A>(i: number, fn: Endomorphism<A>) => (
  array: A[]
): A[] => {
  const clone = array.slice();
  clone[i] = fn(array[i]);
  return clone;
};

export const append = <A>(end: A) => (start: A[]): A[] => start.concat(end);

// TODO: strict version hasOwnProperty check?
export const merge = <S extends StringMap | undefined, P extends Partial<S>>(
  partial: P
): Endomorphism<S> => state => ({
  ...state,
  ...partial,
});

export type Evolver<T> = {
  [K in keyof T]?: Endomorphism<T[K]>;
};

export const evolve = <S extends StringMap, E extends Evolver<S>>(
  evolver: E
): Endomorphism<S> => state => ({
  ...state,
  ...pipe(
    evolver as Record<string, any>,
    mapWithIndex((k, updater) => {
      return updater(state[k]);
      // if (state.hasOwnProperty(k)) {
      //   return updater(state[k]);
      // }
      // throw new Error(`wrong key: ${k}`);
    })
  ),
});

export const ifElse = <A>(
  f: Predicate<A>,
  onTrue: Endomorphism<A>,
  onFalse: Endomorphism<A>
): Endomorphism<A> => x => (f(x) ? onTrue(x) : onFalse(x));

export const when = <A>(f: Predicate<A>, onTrue: Endomorphism<A>) =>
  ifElse(f, onTrue, identity);

export const whenIsDefined = <A, B>(fn: (a: A) => B) => (a: A | undefined) =>
  a === undefined ? a : fn(a);

export const slice = (...params: Parameters<typeof Array.prototype.slice>) => <
  T
>(
  a: T[]
) => a.slice(...params);

export const repeatApply = <A>(repetitions: number, fn: Endomorphism<A>) => (
  a: A
) => {
  let b = a;
  for (let i = 0; i < repetitions; i++) {
    b = fn(b);
  }
  return b;
};

export const mapRecord = <A extends StringMap>(a: A) => <B extends StringMap>(
  updater: (va: ValueOf<A>) => ValueOf<B>
) => mapRecordWithKey(a)<B>((_, v) => updater(v));

export const mapRecordWithKey = <A extends StringMap>(a: A) => <
  B extends StringMap
>(
  updater: (ka: keyof A, va: ValueOf<A>) => ValueOf<B>
): B => {
  const b: any = {};
  for (const k in a) {
    b[k] = updater(k, a[k]);
  }
  return b;
};

export const makeReducer = <S, PBT extends PayloadConfigByType>(
  stateUpdaters: UpdatersByType<S, OriginalPayloadByType<PBT>>
) => ({
  reducer: ((state, { payload, type, undoMundo }) => {
    const updater = undoMundo?.isUndo
      ? stateUpdaters[type].undo
      : stateUpdaters[type].redo;
    return updater ? updater(payload)(state) : state;
  }) as ReducerOf<S, PBT>,
  actionCreators: mapRecordWithKey(stateUpdaters)<ActionCreatorsByType<PBT>>(
    type => (payload, extra) => ({ ...extra, payload, type })
  ),
});
