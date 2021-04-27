import {
  StringMap,
  UpdatersByType,
  Reducer,
  ActionUnion,
  ActionCreatorsByType,
  ValueOf,
  Endomorphism,
} from './types';

export const merge = <S extends StringMap, P extends Partial<S>>(
  partial: P
): Endomorphism<S> => state => ({
  ...state,
  ...partial,
});

// type Evolver<T> = {
//   [K in keyof T]?: Endomorphism<T[K]>;
// };

// export const evolve = <S extends StringMap, E extends Evolver<S>>(
//   evolver: E
// ): Endomorphism<S> => state => ({
//   ...state,
//   ...pipe(
//     evolver as Record<string, any>,
//     mapWithIndex((k, updater) => {
//       if (state.hasOwnProperty(k)) {
//         return updater(state[k]);
//       }
//       throw new Error('booh');
//     })
//   ),
// });

const mapRecord = <B>(
  a: Record<keyof B, any>,
  fn: (k: keyof B) => B[keyof B]
) =>
  (Object.fromEntries(
    Object.entries(a).map(([k, _]) => [k, fn(k as keyof B)])
  ) as any) as B;

export const makeReducer = <S, PBT extends StringMap>(
  stateUpdaters: UpdatersByType<S, PBT>
) => ({
  reducer: ((state, { payload, type }) => {
    const updater = stateUpdaters[type];
    return updater ? updater(payload)(state) : state;
  }) as Reducer<S, ActionUnion<PBT>>,
  actionCreators: mapRecord<ActionCreatorsByType<PBT>>(
    stateUpdaters,
    type => (payload: ValueOf<PBT>) => ({ payload, type })
  ),
});
