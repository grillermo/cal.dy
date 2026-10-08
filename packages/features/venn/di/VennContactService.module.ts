import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import type { VennContactRepository } from "../repositories/VennContactRepository";
import type { VennEventTypeRepository } from "../repositories/VennEventTypeRepository";
import { VennContactService } from "../services/VennContactService";
import { buildAdapterFor, localHost } from "./adapterFactory";
import { VENN_DI_TOKENS } from "./tokens";
import { moduleLoader as contactRepoModuleLoader } from "./VennContactRepository.module";
import { moduleLoader as eventTypeRepoModuleLoader } from "./VennEventTypeRepository.module";

// adapterFor and localHost are not injectable classes, so this subclass builds them from the injected repositories.
class VennContactServiceImpl extends VennContactService {
  constructor(deps: { contactRepo: VennContactRepository; eventTypeRepo: VennEventTypeRepository }) {
    super({
      contactRepo: deps.contactRepo,
      adapterFor: buildAdapterFor(deps.eventTypeRepo),
      localHost,
    });
  }
}

const thisModule = createModule();
const token = VENN_DI_TOKENS.VENN_CONTACT_SERVICE;
const moduleToken = VENN_DI_TOKENS.VENN_CONTACT_SERVICE_MODULE;

const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: VennContactServiceImpl,
  depsMap: { contactRepo: contactRepoModuleLoader, eventTypeRepo: eventTypeRepoModuleLoader },
});

export const moduleLoader: ModuleLoader = { token, loadModule };
export type { VennContactService };
