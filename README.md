# undomundo

This is a library for managing an action-based undo history, with support for time travel and branching. It can be used in a multi-user setting because it allows for modification of the history at the time of undo/redo, as visually explained in [this blog article from Figma](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/#implementing-undo).

Undomundo combines the logic for updating your app state and for updating the undo history state in a reducer function. If you already have a reducer for updating your state, then you can augment it with undo/redo functionality by passing it to `wrapReducer`:

```typescript
import { wrapReducer } from 'undomundo';

// assuming you already have a reducer:
const reducer = (state, action) => {
  switch (action.type) {
    case 'setColor':
      return {
        ...state,
        color: action.payload,
      };
    default:
      return state;
  }
};

const { uReducer, actionCreators } = wrapReducer({
  reducer,
  actionConfigs: {
    // The existing reducer already defines how to update state.
    // Here we define how to store and update each action
    // in the history.
    setColor: {
      // In this case we just overwrite the value in the history
      // with the value from state, and we ignore the previous
      // value from the history:
      updateHistory: state => prevColor => state.color,
    },
  },
});
```

If you do not have an existing reducer it is easier to start from scratch using `makeUndoableReducer`:

```typescript
import { makeUndoableReducer, initUState, undo } from 'undomundo';

const { uReducer, actionCreators } = makeUndoableReducer({
  actionConfigs: {
    // We are not wrapping an existing reducer, so here we additionally
    // need to define how to update the state for each action.
    setColor: {
      updateState: color => state => ({
        ...state,
        color,
      }),
      updateHistory: state => _ => state.color,
    },
  },
});
// continues below ...
```

The returned reducer requires you to pass the current composite state (mainly your app state and the undo history state) and an action object, and it will return the new composite state:

```typescript
// ...
const { setColor } = actionCreators;

// composes your initial app state with the initial history state:
let uState = initUState({
  color: 'red',
});

// here we use the generated 'setColor' action creator:
uState = uReducer(uState, setColor('green'));

// here we use the 'undo' action creator provided by the library:
uState = uReducer(uState, undo());
```

If you prefer a more integrated solution then you can call `makeUndoableState`, which internally calls makeUndoableReducer and stores/updates the composite state for you. This gives you a simpler API, but it may be harder to combine with your UI framework and/or to extend with custom functionality.

```typescript
import { makeUndoableState, initUState } from 'undomundo';

const { undoables, getCurrentUState, undo, ...etc } = makeUndoableState({
  initialUState: initUState({
    color: 'red',
  }),
  actionConfigs: {
    setColor: {
      updateState: color => state => ({
        ...state,
        color,
      }),
      updateHistory: state => _ => state.color,
    },
  },
  onChange: uState => {
    // optionally handle state changes here
  },
});

const { setColor } = undoables;

// not an action creator, but the actual update:
setColor('green');
setColor('blue');
undo();

console.log(getCurrentUState());
```

The above example will approximately log the following composite state:

```typescript
{
  state: {
    // current state:
    color: 'green',
  },
  history: {
    currentBranchId: someUUID,
    currentIndex: 0,
    branches: {
      // By default we will have only one branch:
      someUUID: {
        stack: [
          // This action at index 0 is currently active:
          {
            type: 'setColor',
            payload: {
              // This undo value reflects the initial state:
              undo: 'red',
              redo: 'green',
            },
          },
          {
            type: 'setColor',
            payload: {
              // This undo value was used to create the current state
              undo: 'green',
              redo: 'blue',
            },
          },
        ],
      },
    },
  },
  // This list reflects the results of the last user action, which
  // was 'undo' in this example. In case of the 'timeTravel' or
  // 'switchToBranch' actions there can be multiple state updates.
  // This list can be used to sync actions to other clients and to
  // revert conflicts.
  stateUpdates: [
    {
      action: {
        type: 'setColor',
        payload: {
          undo: 'green',
          redo: 'blue',
        }
      },
      direction: 'undo',
    }
  ],
};
```

In the above example the action at index 0 is currently active. By default the next standard user action (e.g. setColor('orange')) will clear the future and will form the new action at index 1. If instead you want to create a new branch, then pass the option `useBranchingHistory: true` as part of the named `options` argument to one the three main functions. For example:

```typescript
const { undoables, undo, switchToBranch } = makeUndoableState({
  initialUState: initUState({
    color: 'red',
  }),
  actionConfigs: {
    setColor: {
      updateState: color => state => ({
        ...state,
        color,
      }),
      updateHistory: state => _ => state.color,
    },
  },
  options: {
    // set this option to true for a branching history:
    useBranchingHistory: true,
  },
});

const { setColor } = undoables;

setColor('green');
setColor('blue');
undo();
setColor('pink');
setColor('yellow');

//               blue           (branch 1)
//             /
// red - green - pink - YELLOW  (branch 2 = current branch)

switchToBranch('IDofBranch1', 'HEAD_OF_BRANCH');

// red - green - BLUE           (branch 1 = current branch)
//             \
//               pink - yellow  (branch 2)
```

## Type arguments

Undomundo is written in TypeScript so type definitions are included. The three main functions (`wrapReducer`, `makeUndoableReducer`, `makeUndoableState`) require the same type arguments:

- definition of your app state
- definition of your action payloads

For example:

```typescript
import { makeUndoableReducer } from 'undomundo';

type Vector2d = [number, number];

// Definition of state. Let's keep it simple here
// and assume we only store the properties of a
// single item in state.
type State = {
  color: string;
  position: Vector2d;
};

// Definition of action payloads:
type PayloadConfigByType = {
  setColor: {
    payload: string;
  };
  setPosition: {
    payload: Vector2d;
  };
};

const { uReducer } = makeUndoableReducer<State, PayloadConfigByType>({
  actionConfigs: {
    setColor: {
      updateState: color => state => ({
        ...state,
        color,
      }),
      updateHistory: state => _ => state.color,
    },
    setPosition: {
      updateState: position => state => ({
        ...state,
        position,
      }),
      updateHistory: state => _ => state.position,
    },
  },
});
```

By default an action is considered to be absolute, which means that two absolute values for undo and redo are stored in the history. Your can also choose to model an action as relative, which means that only a single relative value is stored in the history. You can for example choose to store the payload for the `setPosition` action in the history as a delta vector [dx, dy] instead of two point vectors [x1, y1] and [x2, y2].

Here is the same example as the previous one, but now with `setPosition` modeled as a relative action:

```typescript
import { makeUndoableReducer } from 'undomundo';

// utilities for manipulating vectors:
import { vAdd, vScale } from 'vec-la-fp';

type Vector2d = [number, number];

type State = {
  color: string;
  position: Vector2d;
};

type PayloadConfigByType = {
  setColor: {
    payload: string;
  };
  setPosition: {
    payload: Vector2d;
    // mark this action as relative:
    isRelative: true;
  };
};

const { uReducer } = makeUndoableReducer<State, PayloadConfigByType>({
  actionConfigs: {
    setColor: {
      updateState: color => state => ({
        ...state,
        color,
      }),
      updateHistory: state => _ => state.color,
    },
    setPosition: {
      updateState: delta => state => ({
        ...state,
        position: vAdd(state.position, delta),
      }),
      // We have no inverse action defined for 'setPosition',
      // so for undo we keep the same action type and negate the payload:
      makeActionForUndo: ({ type, payload }) => ({
        type,
        payload: vScale(-1, payload),
      }),
      // 'updateHistory' is not meaningful for this specific relative
      // action, so we can omit it.
    },
  },
});
```

Finally, note that the choice between an absolute action (two absolute values in the history) and a relative action (one relative value) is perhaps more semantical than technical. You have to consider context and user intent.

## Configuring actions

The three main functions (`wrapReducer`, `makeUndoableReducer`, `makeUndoableState`) all require the named `actionConfigs` argument. This is an object that maps configuration objects by action type.

A config for an absolute action has the following properties:

- `initUndoValue (optional)`: If you do not pass a custom undo value to the action creator, then this function is used to generate the undo value from the state and the initial redo value. If you did not pass a custom undo value _and_ if this function is omitted then the updateHistory function will be used for intializing the undo value.
- `updateHistory`: Function that takes the state and either the initial redo value (on init) or the current history undo/redo value (on undo/redo) and returns either the initial undo value (on init) or a new history undo/redo value (on undo/redo).
- `updateState` (not for `wrapReducer`): Function that takes the value (from the initial action or from undo/redo) and the previous app state, and returns the new app state.

A config for a relative action has the following properties:

- `makeActionForUndo`: Function for converting the action to an action for undo. You can either change the action type (e.g. change 'add' to 'subtract') or invert/negate the payload (e.g. change +42 to -42).
- `updateHistory` (optional): Function that takes the app state and the value from the history, and returns a new value for the history.
- `updateState` (not for `wrapReducer`): Function that takes the value (from the initial action or from undo/redo) and the previous app state, and returns the new app state.
- `updateStateOnUndo` (not for `wrapReducer`, optional): Function for updating the state on undo (overriding 'updateState'). You will probably never need this because you can already convert the action type/payload inside 'makeActionForUndo', but there may be edge cases in which you do not have an inverse action but still want a distinct state update on undo. E.g. you have a 'multiply' action but you do not want to expose a 'divide' action and you do not want to do an inverse multiplication (1/payload) on undo. Note that if you provide this function then you need to define an identity function (action => action) for 'makeActionForUndo'.

## Grouping or skipping actions

In some cases you want to combine multiple user actions (multiple state updates) as a single action in the history (single state update on undo/redo). Undomundo does not enable you to declare in advance which actions should be grouped/skipped and under which circumstances. You can however skip actions on a per-call basis. For example:

```typescript
type Vector2d = [number, number];

type State = {
  position: Vector2d;
};

type PayloadConfigByType = {
  setPosition: {
    payload: Vector2d;
  };
};

const { undoables, getCurrentUState } = makeUndoableState<
  State,
  PayloadConfigByType
>({
  initialUState: initUState({
    position: [10, 10],
  }),
  actionConfigs: {
    setPosition: {
      updateState: position => state => ({
        ...state,
        position,
      }),
      updateHistory: state => _ => state.position,
    },
  },
});

const { setPosition } = undoables;

// standard programmatic update (e.g. snap, align etc.):
setPosition([15, 15]);

let dragStartPosition: Vector2d | undefined;

const handleDragStart = () => {
  dragStartPosition = getCurrentUState().state.position;
};

const handleDragMove = (position: Vector2d) => {
  // on dragMove pass the skipHistory option:
  setPosition(position, { skipHistory: true });
};

const handleDragEnd = (position: Vector2d) => {
  // on dragEnd pass the dragStartPosition as custom undo value:
  setPosition(position, { undoValue: dragStartPosition! });
};

// Or if you feel fancy use a stream (e.g. RxJS) to model drag and drop :)
```

Note that with this approach nothing is recorded in the undo history until drag end. This means that you need to make sure that you do not miss out on drag end (e.g. the user releases the mouse button outside of your app window) and that you do not create an error in the dragEnd handler before calling 'setPosition'. If you would miss the final update then the state is updated but the history is not. If the user than calls `undo`, the action before the drag operation will be undone and the state update of the drag operation is lost (there is no action for it in the history to redo).

## Initializing state

Undomundo's composite state (UState) is an object that includes your undoable app `state`, the undo `history`, and a list of `stateUpdates` that you can optionally use to sync to other clients. Additionally it includes a list of `historyUpdates` for advanced use cases.

You can use the utility `initUState` to compose the intial `state` that you provide with default intial values for `history`, `stateUpdates` and `historyUpdates` (of which the latter two are just empty arrays). Alternatively you can call `initHistory` (or load a persisted history) and compose the object yourself.

```typescript
import { initUState, initHistory, UState } from 'undomundo';

// definition of type arguments State, PayloadConfigByType omitted

const uState = initUState<State, PayloadConfigByType>({
  color: 'green',
  position: [10, 10],
});
// is equal to:
const uState: UState<State, PayloadConfigByType> = {
  state: {
    color: 'green',
    position: [10, 10],
  },
  history: initHistory(),
  stateUpdates: [],
  historyUpdates: [],
};
```

A reducer function created with `wrapReducer` or `makeUndoableReducer` takes the composite state as first argument. The function `makeUndoableState` takes the initial composite state as the named argument `initialUState`.

## Syncing state updates

The `stateUpdates` state can be used for generating actions that you can sync to other clients. By default only the results of the last user action are stored and all previous state updates are automatically cleared. If you want the state updates to accumulate then you have to pass the option `keepStateUpdates: true`. You can then manually clear them using the `clearStateUpdates` action.

```typescript
// shared:
const actionConfigs = {...};

// client 1:
const { uReducer } = makeUndoableReducer({actionConfigs, ...});
let uState = initUState({...});
uState = uReducer(uState, someAction);

pushToOtherClients(uState.stateUpdates);

// client 2:
const { uReducer, getActionFromStateUpdate } = makeUndoableReducer({actionConfigs, ...});
let uState = initUState({...});

onReceiveUpdates(remoteUpdates => {
  // depending on your sync process you may want to revert out-of-sync local updates first:
  const outOfSyncLocalUpdates = ...;
  uState = outOfSyncLocalUpdates.slice().reverse().map(
    // pass invertAction: true
    getActionFromStateUpdate({isSynchronizing: true, invertAction: true})
  ).reduce(uReducer, uState);

  // apply remote updates:
  uState = remoteUpdates.map(
    getActionFromStateUpdate({isSynchronizing: true})
  ).reduce(uReducer, uState);

  // and depending on the process re-apply local updates:
  uState = outOfSyncLocalUpdates.map(
    getActionFromStateUpdate({isSynchronizing: true})
  ).reduce(uReducer, uState);
});
```

How and when you do the syncing depends on your setup and preference. If you use React then you can for example respond to changes in the `stateUpdates` state by means of `useEffect`, or if you use Redux then you can take a look at [Redux-loop](https://redux-loop.js.org/).

It is also possible to do the syncing _before_ the actual state update, but this implies that the higher order reducer ('uReducer') will run twice: Once manually for collecting the updates (e.g. in a Redux middleware) and once for applying the updates (e.g. by means of React's `useReducer` or by means of Redux).

## Separate state and history reducers

If you already have an existing reducer for your app state and you do not want to change the shape of the state (i.e. you do not want to wrap it), then you can make use of the separate `historyReducer` which is returned by `wrapReducer`. You can then run the higher order reducer ('uReducer') manually and use the resulting `stateUpdates` and `historyUpdates` in combination with the separate reducers.

```typescript
const reducer = ...; // existing state reducer

const { uReducer, historyReducer, getActionFromStateUpdate } = wrapReducer({
  reducer,
  actionConfigs: {...},
});

let uState = initUState({...});
const {state, history, stateUpdates, historyUpdates} = uReducer(uState, someAction);

expect(state).toStrictEqual(
  uState.stateUpdates.map(
    getActionFromStateUpdate({isSynchronizing: false})
  ).reduce(reducer, uState.state),
); // should be true

expect(history).toStrictEqual(
  uState.historyUpdates.reduce(historyReducer, uState.history),
); // should be true
```

If you do not have an existing state reducer and you still want separate reducers for your app state and history, then this is also possible using makeUndoableReducer.

```typescript
const {
  uReducer, stateReducer, historyReducer, getActionFromStateUpdate,
} = makeUndoableReducer({
  actionConfigs: {
    ...
  },
});

let uState = initUState({...});
const {state, history, stateUpdates, historyUpdates} = uReducer(uState, someAction);

expect(state).toStrictEqual(
  uState.stateUpdates.map(
    getActionFromStateUpdate({isSynchronizing: false})
  ).reduce(stateReducer, uState.state),
); // should be true

expect(history).toStrictEqual(
  uState.historyUpdates.reduce(historyReducer, uState.history),
); // should be true
```

Note that in these scenarios most of the update logic runs twice: once for collecting the updates and once for applying them. This is due to the history and state
being tightly integrated because the state is used to update the history on undo/redo (and vice versa).

## Still to be documented

- timeTravel / switchToBranch
- adding custom branch data
- action creator options
- creating actions manually (proving id and timestamp)
- wrapReducer / makeUndoableReducer / makeUndoableState options
  - isStateEqual
  - disableUpdateHistory
- perhaps a multi-select example
- helper functions
  - canUndo / canRedo
  - getCurrentBranch
  - getAction
- custom shaped actions (e.g. action.meta )
