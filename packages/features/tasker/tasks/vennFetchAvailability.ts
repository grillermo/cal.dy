import { getVennFetchAvailabilityService } from "@calcom/features/venn/di/VennFetchAvailabilityService.container";
import { z } from "zod";
import { Task } from "../repository";

export const vennFetchAvailabilityPayloadSchema = z.object({ searchResultId: z.number().int() });

export async function vennFetchAvailability(payload: string, taskId?: string): Promise<void> {
  const { searchResultId } = vennFetchAvailabilityPayloadSchema.parse(JSON.parse(payload));
  const isFinalAttempt = await Task.isFinalAttempt(taskId);
  await getVennFetchAvailabilityService().run(searchResultId, { isFinalAttempt });
}
