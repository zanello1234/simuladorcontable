// Registro de minijuegos disponibles.
import type { ComponentType } from 'react';
import type { MinigameId } from '../engine/types';
import { ConciliacionMinigame, CONCILIACION_META } from './conciliacion/ConciliacionMinigame';
import { IvaMinigame, IVA_META } from './iva/IvaMinigame';
import { RecategorizacionMinigame, RECATEGORIZACION_META } from './recategorizacion/RecategorizacionMinigame';
import { SueldosMinigame, SUELDOS_META } from './sueldos/SueldosMinigame';
import type { MinigameMeta, MinigameProps } from './types';

export const MINIGAMES: Record<MinigameId, { meta: MinigameMeta; Component: ComponentType<MinigameProps> }> = {
  iva: { meta: IVA_META, Component: IvaMinigame },
  recategorizacion: { meta: RECATEGORIZACION_META, Component: RecategorizacionMinigame },
  sueldos: { meta: SUELDOS_META, Component: SueldosMinigame },
  conciliacion: { meta: CONCILIACION_META, Component: ConciliacionMinigame },
};
