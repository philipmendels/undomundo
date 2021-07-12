import {
  BranchSwitchModus,
  ClearEffectsAction,
  RedoAction,
  SwitchToBranchAction,
  TimeTravelAction,
  UndoAction,
} from './types/main';

export const undo = (): UndoAction => ({ type: 'undo' });
export const redo = (): RedoAction => ({ type: 'redo' });

export const clearEffects = (): ClearEffectsAction => ({
  type: 'clearEffects',
});

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

export const switchToBranch = (
  branchId: string,
  travelTo?: BranchSwitchModus
): SwitchToBranchAction => ({
  type: 'switchToBranch',
  payload: {
    travelTo,
    branchId,
  },
});
