import { createContainer } from "@calcom/features/di/di";
import { moduleLoader, type VennContactService } from "./VennContactService.module";

const container = createContainer();

export function getVennContactService(): VennContactService {
  moduleLoader.loadModule(container);
  return container.get<VennContactService>(moduleLoader.token);
}
