import { createContainer } from "@calcom/features/di/di";
import { moduleLoader, type VennHiddenEventTypeService } from "./VennHiddenEventTypeService.module";

const container = createContainer();

export function getVennHiddenEventTypeService(): VennHiddenEventTypeService {
  moduleLoader.loadModule(container);
  return container.get<VennHiddenEventTypeService>(moduleLoader.token);
}
