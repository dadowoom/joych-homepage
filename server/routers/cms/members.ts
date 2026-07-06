import { adminProcedure, router } from "../../_core/trpc";
import { getMemberAlertsSummary } from "../../db";

export const cmsMembersRouter = router({
  alertSummary: adminProcedure.query(() => getMemberAlertsSummary()),
});
