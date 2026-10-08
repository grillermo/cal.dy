import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { moduleLoader as prismaModuleLoader } from "@calcom/features/di/modules/Prisma";
import { VennEventTypeRepository } from "../repositories/VennEventTypeRepository";
import { VENN_DI_TOKENS } from "./tokens";

const thisModule = createModule();
const token = VENN_DI_TOKENS.VENN_EVENT_TYPE_REPOSITORY;
const moduleToken = VENN_DI_TOKENS.VENN_EVENT_TYPE_REPOSITORY_MODULE;

const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: VennEventTypeRepository,
  dep: prismaModuleLoader,
});

export const moduleLoader: ModuleLoader = { token, loadModule };
export type { VennEventTypeRepository };
