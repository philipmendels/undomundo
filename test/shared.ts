import { PayloadConfigUndoRedo } from '../src/types';

export type State = {
  count: number;
};

// Need to use an object type literal. Interface does not seem to work due to index signature.
export type PBT = {
  updateCount: PayloadConfigUndoRedo<number>;
  addToCount: {
    original: number;
  };
};
