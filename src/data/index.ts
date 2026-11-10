import raw from './dataset.json';
import type { Dataset } from '../types/models';

/**
 * The demo's single source of truth. To use different data, replace dataset.json
 * (see README → "Replacing the synthetic data") — every view recalculates from it.
 */
export const SEED_DATASET = raw as Dataset;

/** Fresh deep copy so the demo can always reset to the known initial state. */
export function loadInitialDataset(): Dataset {
  return structuredClone(SEED_DATASET);
}
