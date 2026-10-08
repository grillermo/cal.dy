import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import type { VennEventTypeRepository } from "../repositories/VennEventTypeRepository";
import type { VennSearchRepository } from "../repositories/VennSearchRepository";
import { VennFetchAvailabilityService } from "../services/VennFetchAvailabilityService";
import { buildAdapterFor } from "./adapterFactory";
import { VENN_DI_TOKENS } from "./tokens";
import { moduleLoader as eventTypeRepoModuleLoader } from "./VennEventTypeRepository.module";
import { moduleLoader as searchRepoModuleLoader } from "./VennSearchRepository.module";

// adapterFor is not an injectable class, so this subclass builds it from the injected event type repository.
class VennFetchAvailabilityServiceImpl extends VennFetchAvailabilityService {
  constructor(deps: { searchRepo: VennSearchRepository; eventTypeRepo: VennEventTypeRepository }) {
    super({ searchRepo: deps.searchRepo, adapterFor: buildAdapterFor(deps.eventTypeRepo) });
  }
}

const thisModule = createModule();
const token = VENN_DI_TOKENS.VENN_FETCH_AVAILABILITY_SERVICE;
const moduleToken = VENN_DI_TOKENS.VENN_FETCH_AVAILABILITY_SERVICE_MODULE;

const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: VennFetchAvailabilityServiceImpl,
  depsMap: { searchRepo: searchRepoModuleLoader, eventTypeRepo: eventTypeRepoModuleLoader },
});

export const moduleLoader: ModuleLoader = { token, loadModule };
export type { VennFetchAvailabilityService };
