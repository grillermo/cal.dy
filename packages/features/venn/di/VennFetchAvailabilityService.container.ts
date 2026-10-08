import { createContainer } from "@calcom/features/di/di";
import { moduleLoader, type VennFetchAvailabilityService } from "./VennFetchAvailabilityService.module";

const container = createContainer();

export function getVennFetchAvailabilityService(): VennFetchAvailabilityService {
  moduleLoader.loadModule(container);
  return container.get<VennFetchAvailabilityService>(moduleLoader.token);
}
