// import { pipe } from 'fp-ts/lib/function';
// import { makeDefaultEffectConfig } from '../src/helpers';
// import { createInitialHistory } from '../src/internal';
// import { makeHistoryReducer } from '../src/make-history-reducer';
// import { History } from '../src/types/history';
// import { Action, DefaultPayloadConfig, Reducer } from '../src/types/main';
// import { merge } from '../src/util';

// type Actions =
//   // | {
//   //     type: 'addToCount';
//   //     payload: number;
//   //   }
//   // | {
//   //     type: 'subtractFromCount';
//   //     payload: number;
//   //   }
//   | {
//       type: 'updateCount';
//       payload: number;
//     }
//   | {
//       type: 'updateHistory';
//       payload: History<PBT>;
//     };

// type PBT = {
//   updateCount: DefaultPayloadConfig<number>;
//   // addToCount: RelativePayloadConfig<number>;
//   // subtractFromCount: RelativePayloadConfig<number>;
// };

// type State = {
//   count: number;
//   history: History<PBT>;
// };

// let state: State = {
//   count: 2,
//   history: createInitialHistory(),
// };

// const reducer: Reducer<State, Actions> = (state, action) => {
//   // if (action.type === 'addToCount') {
//   //   const { payload } = action;
//   //   return pipe(state, evolve({ count: add(payload) }));
//   // }
//   // if (action.type === 'subtractFromCount') {
//   //   return pipe(state, evolve({ count: subtract(action.payload) }));
//   // }
//   if (action.type === 'updateCount') {
//     return pipe(state, merge({ count: action.payload }));
//   }
//   return state;
// };

// const { uReducer: historyReducer, actionCreators } = makeHistoryReducer<
//   State,
//   PBT
// >({
//   // addToCount: makeRelativePartialActionConfig({
//   //   // payload conversion:
//   //   makeActionForUndo: evolve({ payload: negate }),
//   // }),
//   // subtractFromCount: makeRelativePartialActionConfig({
//   //   // type conversion:
//   //   makeActionForUndo: ({ payload }) => ({ type: 'addToCount', payload }),
//   // }),
//   updateCount: makeDefaultEffectConfig({
//     updatePayload: state => _ => state.count,
//   }),
// });

// const { updateCount } = actionCreators;

// const middleWare = (action: Action) => {
//   const {history, effects} = historyReducer({})
// }

// describe('makeHistoryReducer', () => {
//   it('works', () => {
//     const action = updateCount(7);
//     const
//     expect(state.count).toBe(7);
//     undo();
//     expect(state.count).toBe(2);
//     redo();
//     expect(state.count).toBe(7);
//   });
// });

// // type Dispatch = (action: Action) => void;

// // type Store = {
// //   getState: () => {
// //     history: History<PBT>;
// //     state: State;
// //   };
// //   dispatch: Dispatch;
// // };

// // const middleWare = (store: Store) => (next: Dispatch) => {
// //   const
// // };
