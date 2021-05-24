import { RedoAction, TimeTravelAction, UndoAction } from './types/main';

export const undo = (): UndoAction => ({ type: 'undo' });
export const redo = (): RedoAction => ({ type: 'redo' });

export const timeTravel = (
  indexOnBranch: number,
  branchId?: string
): TimeTravelAction => ({
  type: 'timeTravel',
  payload: {
    indexOnBranch,
    branchId,
  },
});
