import { createContainer } from "@calcom/features/di/di";
import { moduleLoader, type VennSearchService } from "./VennSearchService.module";

const container = createContainer();

export function getVennSearchService(): VennSearchService {
  moduleLoader.loadModule(container);
  return container.get<VennSearchService>(moduleLoader.token);
}
