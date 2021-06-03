import { identity } from 'fp-ts/function';
import { makeHistoryReducer } from './make-history-reducer';
import { History } from './types/history';
import {
  BaseConfigByType,
  Effect,
  MetaAction,
  PartialActionConfigByType,
  PayloadConfigByType,
} from './types/main';
import { mapRecord } from './util';

export const makeGetEffects = <PBT extends PayloadConfigByType>(
  configs: BaseConfigByType<PBT>
) => {
  const { uReducer } = makeHistoryReducer<{}, PBT>(
    mapRecord(configs)<PartialActionConfigByType<{}, PBT>>(config => ({
      ...config,
      initPayload: _ => identity,
    })),
    {
      storeEffects: true,
    }
  );
  return (history: History<PBT>, action: MetaAction): Effect<PBT>[] =>
    uReducer({ state: {}, history, effects: [] }, action).effects;
};
