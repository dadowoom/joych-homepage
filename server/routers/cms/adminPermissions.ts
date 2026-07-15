import { z } from "zod";
import { adminProcedure, router } from "../../_core/trpc";
import {
  getAllAdminPermissionDefinitions,
  getAssignedMemberAdminPermissionAssignments,
  getMemberAdminPermissionAssignments,
  setMemberAdminPermissions,
} from "../../db";

export const adminPermissionsRouter = router({
  list: adminProcedure
    .input(
      z.object({
        searchTerm: z.string().trim().max(80).optional(),
      }).optional(),
    )
    .query(async ({ input }) => {
      const [permissions, subjects, assignedSubjects] = await Promise.all([
        getAllAdminPermissionDefinitions(),
        getMemberAdminPermissionAssignments(input?.searchTerm ?? ""),
        getAssignedMemberAdminPermissionAssignments(),
      ]);
      return { permissions, subjects, assignedSubjects };
    }),

  set: adminProcedure
    .input(z.object({
      memberId: z.number().int().positive(),
      permissionKeys: z.array(z.string().trim().min(1).max(128)).max(300),
    }))
    .mutation(({ input }) => setMemberAdminPermissions(input.memberId, input.permissionKeys)),
});
