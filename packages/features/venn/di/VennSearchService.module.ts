import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import tasker from "@calcom/features/tasker";
import { TaskProcessor } from "@calcom/features/tasker/task-processor";
import { after } from "next/server";
import { fetchLocalSlotsFromService } from "../adapters/local";
import type { VennContactRepository } from "../repositories/VennContactRepository";
import type { VennSearchRepository } from "../repositories/VennSearchRepository";
import type { VennHiddenEventTypeService } from "../services/VennHiddenEventTypeService";
import { VennSearchService } from "../services/VennSearchService";
import { VENN_DI_TOKENS } from "./tokens";
import { moduleLoader as contactRepoModuleLoader } from "./VennContactRepository.module";
import { moduleLoader as hiddenEventTypeServiceModuleLoader } from "./VennHiddenEventTypeService.module";
import { moduleLoader as searchRepoModuleLoader } from "./VennSearchRepository.module";

// tasker, kick, fetchSlots and now are runtime wiring rather than injectable classes, so this subclass supplies them.
class VennSearchServiceImpl extends VennSearchService {
  constructor(deps: {
    searchRepo: VennSearchRepository;
    contactRepo: VennContactRepository;
    hiddenEventTypeService: VennHiddenEventTypeService;
  }) {
    super({
      ...deps,
      tasker,
      kick: () => after(() => new TaskProcessor().processQueue()),
      fetchSlots: fetchLocalSlotsFromService,
      now: () => new Date(),
    });
  }
}

const thisModule = createModule();
const token = VENN_DI_TOKENS.VENN_SEARCH_SERVICE;
const moduleToken = VENN_DI_TOKENS.VENN_SEARCH_SERVICE_MODULE;

const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: VennSearchServiceImpl,
  depsMap: {
    searchRepo: searchRepoModuleLoader,
    contactRepo: contactRepoModuleLoader,
    hiddenEventTypeService: hiddenEventTypeServiceModuleLoader,
  },
});

export const moduleLoader: ModuleLoader = { token, loadModule };
export type { VennSearchService };
