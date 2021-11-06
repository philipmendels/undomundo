# undomundo

This is a library for managing an action-based undo history, with support for time travel and branching. It can be used in a multi-user setting because it allows for modification of the history at the time of undo/redo, as visually explained in [this great blog article from Figma](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/#implementing-undo).

Undomundo combines the logic for updating your app state and for updating the undo history state in a reducer function. If you already have a reducer for updating your state, then you can augment it with undo/redo functionality by passing it to `wrapReducer`:

```typescript
import { wrapReducer, makeDefaultPartialActionConfig } from 'undomundo';

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
    setColor: makeDefaultPartialActionConfig({
      getValueFromState: state => state.color,
      // In this case we just overwrite the value in the history
      // with the value from state, and we ignore the previous
      // value from the history:
      updateHistory: color => prevColor => color,
    }),
  },
});
```

If you do not have an existing reducer it is easier to start from scratch using `makeUndoableReducer`:

```typescript
import {
  makeUndoableReducer,
  makeDefaultActionConfig,
  initUState,
  undo,
} from 'undomundo';

const { uReducer, actionCreators } = makeUndoableReducer({
  actionConfigs: {
    // We are not wrapping an existing reducer, so here we additionally
    // need to define how to update the state for each action.
    setColor: makeDefaultActionConfig({
      updateState: color => state => ({
        ...state,
        color,
      }),
      getValueFromState: state => state.color,
      updateHistory: color => _ => color,
    }),
  },
});
// continues below ...
```

The returned reducer requires you to pass the current composite state (your app state, the undo history state and 'output' state for optional syncing to other clients) and an action object, and it will return the new composite state:

```typescript
// ...
const { setColor } = actionCreators;

// composes your initial app state with the initial history state:
let uState = initUState({
  color: 'red',
});

uState = uReducer(uState, { type: 'setColor', payload: 'green' });
// or use the generated action creator:
uState = uReducer(uState, setColor('blue'));

uState = uReducer(uState, { type: 'undo' });
// or alternatively use the undo action creator
// provided by the library:
uState = uReducer(uState, undo());
```

If you prefer a more integrated solution then you can call `makeUndoableState`, which internally calls makeUndoableReducer and stores/updates the composite state for you. This gives you a simpler API, but it may be harder to combine with your UI framework and/or to extend with custom functionality.

```typescript
import {
  makeUndoableState,
  makeDefaultActionConfig,
  initUState,
} from 'undomundo';

const { undoables, getCurrentUState, undo, ...etc } = makeUndoableState({
  initialUState: initUState({
    color: 'red',
  }),
  actionConfigs: {
    setColor: makeDefaultActionConfig({
      updateState: color => state => ({
        ...state,
        color,
      }),
      getValueFromState: state => state.color,
      updateHistory: color => _ => color,
    }),
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
              // This undo value represents the initial state:
              undo: 'red',
              redo: 'green',
            },
          },
          {
            type: 'setColor',
            payload: {
              // This undo value was used to create the
              // current state and to create the output:
              undo: 'green',
              redo: 'blue',
            },
          },
        ],
      },
    },
  },
  // This represents the output of the last user action, which
  // was 'undo()' in this example. In case of 'timetravel(toIndex)'
  // there can be multiple output actions.
  output: [
    {
      type: 'setColor',
      payload: 'green',
    },
  ],
};
```

In the above example the action at index 0 is currently active. By default the next standard user action (e.g. setColor('orange')) will clear the future and will form the new action at index 1. If instead you want to store the current future and branch of to a new future, pass the option `useBranchingHistory: true` as part of the named `options` argument to one the three main functions. For example:

```typescript
const { undoables, undo, timeTravel, switchToBranch } = makeUndoableState({
  initialUState: initUState({
    color: 'red',
  }),
  actionConfigs: {
    setColor: makeDefaultActionConfig({
      updateState: color => state => ({
        ...state,
        color,
      }),
      getValueFromState: state => state.color,
      updateHistory: color => _ => color,
    }),
  },
  options: {
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

timeTravel(
  0, // index on branch
  'IDofBranch1' // optional branch id, defaults to current
);
// or alternatively:
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
import {
  DefaultPayloadConfig,
  makeUndoableReducer,
  makeDefaultActionConfig,
} from 'undomundo';

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
  setColor: DefaultPayloadConfig<string>;
  setPosition: DefaultPayloadConfig<Vector2d>;
};

const { uReducer } = makeUndoableReducer<State, PayloadConfigByType>({
  actionConfigs: {
    setColor: makeDefaultActionConfig({
      updateState: color => state => ({
        ...state,
        color,
      }),
      getValueFromState: state => state.color,
      updateHistory: color => _ => color,
    }),
    setPosition: makeDefaultActionConfig({
      updateState: position => state => ({
        ...state,
        position,
      }),
      getValueFromState: state => state.position,
      updateHistory: position => _ => position,
    }),
  },
});
```

For each action payload we need to define the `original` type and the `history` type. The generic `DefaultPayloadConfig<T>` type is used for absolute actions and defines that the payload in the `history` is modelled as an object with undo/redo properties:

```typescript
type PayloadConfigByType = {
  setColor: DefaultPayloadConfig<string>;
  // which is equal to:
  setColor: {
    original: string;
    history: {
      undo: string;
      redo: string;
    };
  };
  setPosition: DefaultPayloadConfig<Vector2d>;
};
```

Your are free to model your actions as relative instead of absolute. You could for example choose to store the payload for the setPosition action in the history as a delta vector [dx, dy] instead of two point vectors [x1, y1] and [x2, y2]. In this case you can use the generic `RelativePayloadConfig<T>` type, which defines that the `original` and `history` payload types are equal:

```typescript
type PayloadConfigByType = {
  setColor: DefaultPayloadConfig<string>;
  setPosition: RelativePayloadConfig<Vector2d>;
  // which is equal to:
  setPosition: {
    original: Vector2d;
    history: Vector2d;
  };
};
```

Here is the same example as the previous one, but now with `setPosition` modeled as a relative action:

```typescript
import {
  DefaultPayloadConfig,
  RelativePayloadConfig,
  makeDefaultActionConfig,
  makeRelativeActionConfig,
  makeUndoableReducer,
} from 'undomundo';

// utilities for manipulating vectors:
import { vAdd, vScale } from 'vec-la-fp';

type Vector2d = [number, number];

type State = {
  color: string;
  position: Vector2d;
};

type PayloadConfigByType = {
  setColor: DefaultPayloadConfig<string>;
  setPosition: RelativePayloadConfig<Vector2d>;
};

const { uReducer } = makeUndoableReducer<State, PayloadConfigByType>({
  actionConfigs: {
    setColor: makeDefaultActionConfig({
      updateState: color => state => ({
        ...state,
        color,
      }),
      getValueFromState: state => state.color,
      updateHistory: color => _ => color,
    }),
    setPosition: makeRelativeActionConfig({
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
    }),
  },
});
```

Finally, note that the choice between an absolute action (two absolute values in the history) and a relative action (one relative value) is perhaps more semantical than technical. You have to consider context and user intent.

## Configuring actions

The three main functions (`wrapReducer`, `makeUndoableReducer`, `makeUndoableState`) all require the named `actionConfigs` argument. This is an object that maps configuration objects by action type. Each config has the following properties:

- `initPayloadInHistory`: Function for initializing the action payload in the history, based on the current state, a value for redo, and an optional value for undo. E.g. for an absolute action return an object with as `undo` property the optionally provided undo value or the current value from the state, and as `redo` property the provided redo value. For a relative action just return the provided redo value.
- `makeActionForUndo`: Function for converting the action in the history to an action for `undo`. E.g. for an absolute action return an action object with as payload the `undo` part of the payload from the history, and for a relative action return the action from the history with either the action type changed (e.g. change 'add' to 'subtract') or the payload negated (e.g. change +42 to -42).
- `getPayloadForRedo`: Function for converting the payload in the history to the payload for `redo`. E.g. for an absolute action return the value of the `redo` property, and for a relative action just return the payload as stored.
- `updateHistoryOnUndo`: Optional function for updating the payload in the history on `undo`, based on the current state. E.g for an absolute action replace the value of the `redo` property in the history with the current value selected from the state. For most relative actions updating the history is probably not meaningful, but there could be edge-cases such as modelling object creation/removal as relative actions.
- `updateHistoryOnRedo`: Optional function for updating the payload in the history on `redo`, based on the current state. E.g for an absolute action replace the value at the `undo` key in the history with the current value selected from the state. For most relative actions updating the history is probably not meaningful.

The action configs that you pass to `makeUndoableReducer` and `makeUndoableState` additionally require:

- `updateState`: Function for updating the state on undo/redo, based on the payload of the action returned by `makeActionForUndo` or the payload returned by `getPayloadForRedo`.
- `updateStateOnUndo`: Optional function for updating the state on undo (overriding `updateState`). In general you will not need this because you can already convert the action type/payload inside `makeActionForUndo`, but there may be cases in which you prefer a distinct state update on undo for relative actions (e.g. rather than adding a negated payload, subtracting the payload as stored).

## Helper functions for configuring actions

In most situations you will probably not need to manually define all the properties of an action config. Instead you can use the following helper functions to construct it:

`makeDefaultActionConfig`: For absolute actions. Stores the payload in the history as an object with 'undo' and 'redo' properties. Takes `updateState` and `getValueFromState` functions as required named arguments, and an `updateHistory` function as optional named argument. The updateHistory function takes the value from state as input. Behind the scenes the getValueFromState function is used for initializing the undo part of the payload in the history.

`makeRelativeActionConfig`: For relative actions. Makes the payload in the history identical to the original action payload. Takes `updateState` and `makeActionForUndo` functions as required named arguments, and an `updateHistory` function as optional named argument. Because there is separate value getter function, the updateHistory function takes the state as input rather than the value.

For both the above helper functions there are partial equivalents (`makeDefaultPartialActionConfig` and `makeRelativePartialActionConfig`) that you can use to make action configs for `wrapReducer`. These take the same named arguments except for `updateState`.

In the below example you can see the output of `makeDefaultActionConfig`:

```typescript
const { uReducer } = makeUndoableReducer<State, PayloadConfigByType>({
  actionConfigs: {
    setColor: makeDefaultActionConfig({
      updateState: color => state => ({
        ...state,
        color,
      }),
      getValueFromState: state => state.color,
      updateHistory: color => _ => color,
    }),
    // which will generate the following config:
    setColor: {
      updateState: color => state => ({
        ...state,
        color,
      }),
      initPayloadInHistory: state => (redoValue, undoValue) => ({
        undo: undoValue === undefined ? state.color : undoValue,
        redo: redoValue,
      }),
      makeActionForUndo: ({ type, payload }) => ({
        type,
        payload: payload.undo,
      }),
      getPayloadForRedo: ({ redo }) => redo,
      updateHistoryOnUndo: state => ({ undo }) => ({
        undo,
        redo: state.color,
      }),
      updateHistoryOnRedo: state => ({ redo }) => ({
        undo: state.color,
        redo,
      }),
    },
  },
});
```

If you don't like the default way of storing absolute payloads in the history as objects with 'undo' and 'redo' properties, then you can construct your own helper function using `makeAbsoluteActionConfig` (and `makeAbsolutePartialActionConfig`). For example, if you prefer to store the absolute undo/redo payloads as a 2-tuple:

```typescript
import { makeAbsoluteActionConfig } from 'undomundo';

const makeTupleActionConfig = makeAbsoluteActionConfig({
  composeUndoRedo: (undo, redo) => [undo, redo],
  getUndo: ([undo]) => undo,
  getRedo: ([_, redo]) => redo,
});
```

In the below example you can see the output of `makeRelativeActionConfig`:

```typescript
import { vAdd, vScale } from 'vec-la-fp';

const { uReducer } = makeUndoableReducer<State, PayloadConfigByType>({
  actionConfigs: {
    setPosition: makeRelativeActionConfig({
      updateState: delta => state => ({
        ...state,
        position: vAdd(state.position, delta),
      }),
      makeActionForUndo: ({ type, payload }) => ({
        type,
        payload: vScale(-1, payload),
      }),
    }),
    // which will generate the following config:
    setPosition: {
      updateState: delta => state => ({
        ...state,
        position: vAdd(state.position, delta),
      }),
      makeActionForUndo: ({ type, payload }) => ({
        type,
        payload: vScale(-1, payload),
      }),
      getPayloadForRedo: delta => delta,
      initPayloadInHistory: _ => delta => delta,
    },
  },
});
```

If you want to define a separate state updater for undo instead of converting the action, then define the config for your relative action manually:

```typescript
import { vAdd, vSub } from 'vec-la-fp';

const { uReducer } = makeUndoableReducer<State, PayloadConfigByType>({
  actionConfigs: {
    setPosition: {
      updateState: delta => state => ({
        ...state,
        position: vAdd(state.position, delta),
      }),
      // separate state updater for undo:
      updateStateOnUndo: delta => state => ({
        ...state,
        position: vSub(state.position, delta),
      }),
      // no type or payload conversion for undo:
      makeActionForUndo: action => action,
      getPayloadForRedo: delta => delta,
      initPayloadInHistory: _ => delta => delta,
      // or if you want to include computation of the delta:
      initPayloadInHistory: state => (redoValue, undoValue) =>
        vSub(position, undoValue || state.position),
    },
  },
});
```

## Grouping or skipping actions

In some cases you want to combine multiple user actions (multiple state updates) as a single action in the history (single state update on undo/redo). Undomundo does not enable you to declare in advance which actions should be grouped/skipped and under which circumstances. You can however skip actions on a per-call basis. For example:

```typescript
type Vector2d = [number, number];

type State = {
  position: Vector2d;
};

type PayloadConfigByType = {
  setPosition: DefaultPayloadConfig<Vector2d>;
};

const { undoables, getCurrentUState } = makeUndoableState<
  State,
  PayloadConfigByType
>({
  initialUState: initUState({
    position: [10, 10],
  }),
  actionConfigs: {
    setPosition: makeDefaultActionConfig({
      updateState: position => state => ({
        ...state,
        position,
      }),
      getValueFromState: state => state.position,
      updateHistory: position => _ => position,
    }),
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

Undomundo's composite state (UState) is an object that includes your undoable app `state`, the undo `history`, and a list of `output` actions that you can optionally use to sync to other clients.

You can use the utility `initUState` to compose the intial `state` that you provide with default intial values for `history` and `output` (of which the latter is just an empty array). Alternatively you can call `initHistory` (or load a persisted history) and compose the object yourself.

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
  output: [],
};
```

A reducer function created with `wrapReducer` or `makeUndoableReducer` takes the composite state as first argument. The function `makeUndoableState` takes the initial composite state as the named argument `initialUState`.

## Custom branch data

## Syncing output actions

You can use the `output` state to sync actions to other clients. By default it only stores the result of the last user action and automatically clears all previous output. In this case the last user action was `undo()` and you can see that the payload is equal to the `undo` part of the composite payload of the last item in the history. If you want the output to accumulate and to manually clear it, pass the option `keepOutput: true`.

## Decoupling state and output
