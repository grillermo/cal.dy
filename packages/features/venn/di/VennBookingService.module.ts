import {
  type RegularBookingService,
  moduleLoader as regularBookingServiceModuleLoader,
} from "@calcom/features/bookings/di/RegularBookingService.module";
import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { WEBAPP_URL } from "@calcom/lib/constants";
import type { VennContactRepository } from "../repositories/VennContactRepository";
import type { VennSearchRepository } from "../repositories/VennSearchRepository";
import { VennBookingService } from "../services/VennBookingService";
import type { VennHiddenEventTypeService } from "../services/VennHiddenEventTypeService";
import type { VennSearchService } from "../services/VennSearchService";
import { VENN_DI_TOKENS } from "./tokens";
import { moduleLoader as contactRepoModuleLoader } from "./VennContactRepository.module";
import { moduleLoader as hiddenEventTypeServiceModuleLoader } from "./VennHiddenEventTypeService.module";
import { moduleLoader as searchRepoModuleLoader } from "./VennSearchRepository.module";
import { moduleLoader as searchServiceModuleLoader } from "./VennSearchService.module";

// createBooking, hostname and now are runtime wiring rather than injectable classes, so this subclass supplies them.
class VennBookingServiceImpl extends VennBookingService {
  constructor(deps: {
    searchRepo: VennSearchRepository;
    contactRepo: VennContactRepository;
    hiddenEventTypeService: VennHiddenEventTypeService;
    searchService: VennSearchService;
    regularBookingService: RegularBookingService;
  }) {
    const { regularBookingService, ...rest } = deps;
    super({
      ...rest,
      createBooking: async (input) => {
        const booking = await regularBookingService.createBooking(input);
        if (!booking.uid)
          throw new Error(`Booking for event type ${input.bookingData.eventTypeId} has no uid`);
        return { uid: booking.uid };
      },
      hostname: new URL(WEBAPP_URL).host,
      now: () => new Date(),
    });
  }
}

const thisModule = createModule();
const token = VENN_DI_TOKENS.VENN_BOOKING_SERVICE;
const moduleToken = VENN_DI_TOKENS.VENN_BOOKING_SERVICE_MODULE;

const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: VennBookingServiceImpl,
  depsMap: {
    searchRepo: searchRepoModuleLoader,
    contactRepo: contactRepoModuleLoader,
    hiddenEventTypeService: hiddenEventTypeServiceModuleLoader,
    searchService: searchServiceModuleLoader,
    regularBookingService: regularBookingServiceModuleLoader,
  },
});

export const moduleLoader: ModuleLoader = { token, loadModule };
export type { VennBookingService };
