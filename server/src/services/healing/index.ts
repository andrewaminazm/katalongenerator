export {
  normalizeFailureReport,
  classifyErrorMessage,
} from "./failureDetector.js";
export { generateRuleBasedFallbacks } from "./fallbackLocatorGenerator.js";
export { scoreHealingCandidate } from "./healingScorer.js";
export { tryLocatorsUntilSuccess, DEFAULT_MAX_RETRIES } from "./retryExecutor.js";
export { repairLocatorsWithOllama } from "./aiLocatorRepair.js";
export {
  lookupHealingMemory,
  saveHealingSuccess,
  listHealingMemory,
} from "./healingMemoryStore.js";
export { runLocatorHealing } from "./locatorHealingEngine.js";
export type * from "./types.js";
