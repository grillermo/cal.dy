import { createContainer } from "@calcom/features/di/di";
import { moduleLoader, type VennBookingService } from "./VennBookingService.module";

const container = createContainer();

export function getVennBookingService(): VennBookingService {
  moduleLoader.loadModule(container);
  return container.get<VennBookingService>(moduleLoader.token);
}
