import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { WEBAPP_URL } from "@calcom/lib/constants";
import { getAdapter } from "../adapters/getAdapter";
import { fetchLocalSlotsFromService, LocalAdapter } from "../adapters/local";
import type { VennContactRepository } from "../repositories/VennContactRepository";
import type { VennEventTypeRepository } from "../repositories/VennEventTypeRepository";
import { VennContactService } from "../services/VennContactService";
import { VENN_DI_TOKENS } from "./tokens";
import { moduleLoader as contactRepoModuleLoader } from "./VennContactRepository.module";
import { moduleLoader as eventTypeRepoModuleLoader } from "./VennEventTypeRepository.module";

const localHost = new URL(WEBAPP_URL).host;

// adapterFor and localHost are not injectable classes, so this subclass builds them from the injected repositories.
class VennContactServiceImpl extends VennContactService {
  constructor(deps: { contactRepo: VennContactRepository; eventTypeRepo: VennEventTypeRepository }) {
    const localAdapter = new LocalAdapter({
      lookup: deps.eventTypeRepo,
      fetchSlots: fetchLocalSlotsFromService,
      localHost,
    });
    super({
      contactRepo: deps.contactRepo,
      adapterFor: (provider) => getAdapter(provider, { localAdapter }),
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
