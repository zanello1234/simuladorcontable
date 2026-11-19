// Registro de minijuegos disponibles.
import type { ComponentType } from 'react';
import type { MinigameId } from '../engine/types';
import { ApocrifasMinigame, APOCRIFAS_META } from './apocrifas/ApocrifasMinigame';
import { ConciliacionMinigame, CONCILIACION_META } from './conciliacion/ConciliacionMinigame';
import { GananciasMinigame, GANANCIAS_META } from './ganancias/GananciasMinigame';
import { IvaMinigame, IVA_META } from './iva/IvaMinigame';
import { RecategorizacionMinigame, RECATEGORIZACION_META } from './recategorizacion/RecategorizacionMinigame';
import { SueldosMinigame, SUELDOS_META } from './sueldos/SueldosMinigame';
import type { MinigameMeta, MinigameProps } from './types';

export const MINIGAMES: Partial<Record<MinigameId, { meta: MinigameMeta; Component: ComponentType<MinigameProps> }>> = {
  iva: { meta: IVA_META, Component: IvaMinigame },
  recategorizacion: { meta: RECATEGORIZACION_META, Component: RecategorizacionMinigame },
  sueldos: { meta: SUELDOS_META, Component: SueldosMinigame },
  conciliacion: { meta: CONCILIACION_META, Component: ConciliacionMinigame },
  apocrifas: { meta: APOCRIFAS_META, Component: ApocrifasMinigame },
  ganancias_ph: { meta: GANANCIAS_META, Component: GananciasMinigame },
};
