import { z } from "zod";

export const getAuditLogsQuerySchema = z.object({
    containerName: z.string().optional(),
    operation: z.enum(["create", "update", "delete", "read", "all"]).optional(),
    page: z.string().min(1).default("1"),
    rowsPerPage: z.string().min(1).default("10")
}); 