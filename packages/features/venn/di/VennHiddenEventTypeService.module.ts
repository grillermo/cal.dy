import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { VennHiddenEventTypeService } from "../services/VennHiddenEventTypeService";
import { VENN_DI_TOKENS } from "./tokens";
import { moduleLoader as eventTypeRepoModuleLoader } from "./VennEventTypeRepository.module";

const thisModule = createModule();
const token = VENN_DI_TOKENS.VENN_HIDDEN_EVENT_TYPE_SERVICE;
const moduleToken = VENN_DI_TOKENS.VENN_HIDDEN_EVENT_TYPE_SERVICE_MODULE;

const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: VennHiddenEventTypeService,
  depsMap: { eventTypeRepo: eventTypeRepoModuleLoader },
});

export const moduleLoader: ModuleLoader = { token, loadModule };
export type { VennHiddenEventTypeService };
