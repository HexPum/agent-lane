export { lima } from "./provider.js";
export { createRunProvenance, verifySha256 } from "./provenance.js";
export { createRegistry, defaultRegistryPath } from "./registry.js";
export type {
  LaneRegistry,
  RegistryEntry,
  RegistryProvenance,
} from "./registry.js";
export type {
  CommandOptions,
  LimaProviderOptions,
  LimaRuntime,
  LimaSandboxProvider,
  RunProvenance,
  SpawnSpec,
} from "./types.js";
