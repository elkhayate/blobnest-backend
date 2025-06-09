import { z } from 'zod';

export const createContainerSchema = z.object({
  name: z.string()
    .min(3, "Container name must be at least 3 characters")
    .max(63, "Container name cannot exceed 63 characters")
    .regex(/^[a-z0-9-]+$/, "Container name can only contain lowercase letters, numbers, and hyphens"),
  publicAccess: z.enum(["blob", "container"]).optional()
});

export const updateContainerSchema = z.object({
  publicAccess: z.enum(["blob", "container", ]).optional(),
  metadata: z.record(z.string()).optional()
});

export const getContainersQuerySchema = z.object({
  search: z.string().max(100, "Search query cannot exceed 100 characters").optional(),
  publicAccess: z.enum(["all", "blob", "container"], {
    errorMap: () => ({ message: "Public access must be either 'all', 'blob', 'container', or 'none'" }),
  }).optional(),
  page: z.coerce.number().int().positive().default(1),
  rowsPerPage: z.coerce.number().int().positive().default(10)
});

export type CreateContainerInput = z.infer<typeof createContainerSchema>;
export type UpdateContainerInput = z.infer<typeof updateContainerSchema>;
export type GetContainersQuery = z.infer<typeof getContainersQuerySchema>;