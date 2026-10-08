import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { moduleLoader as prismaModuleLoader } from "@calcom/features/di/modules/Prisma";
import { VennContactRepository } from "../repositories/VennContactRepository";
import { VENN_DI_TOKENS } from "./tokens";

const thisModule = createModule();
const token = VENN_DI_TOKENS.VENN_CONTACT_REPOSITORY;
const moduleToken = VENN_DI_TOKENS.VENN_CONTACT_REPOSITORY_MODULE;

const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: VennContactRepository,
  dep: prismaModuleLoader,
});

export const moduleLoader: ModuleLoader = { token, loadModule };
export type { VennContactRepository };
