import { z } from 'zod';

export const getFilesQuerySchema = z.object({
  search: z.string().max(100, "Search query cannot exceed 100 characters").optional(),
  contentType: z.string().max(100, "Content type cannot exceed 100 characters").optional(),
  page: z.coerce.number().int().positive().default(1),
  rowsPerPage: z.coerce.number().int().positive().default(10)
});

export const uploadFileSchema = z.object({
  containerName: z.string()
    .min(3, "Container name must be at least 3 characters")
    .max(63, "Container name cannot exceed 63 characters")
    .regex(/^[a-z0-9-]+$/, "Container name can only contain lowercase letters, numbers, and hyphens"),
  metadata: z.string().optional()
});

export const updateFileSchema = z.object({
  metadata: z.record(z.string()).optional(),
  contentType: z.string().max(100, "Content type cannot exceed 100 characters").optional()
});

export const fileParamsSchema = z.object({
  containerName: z.string()
    .min(3, "Container name must be at least 3 characters")
    .max(63, "Container name cannot exceed 63 characters")
    .regex(/^[a-z0-9-]+$/, "Container name can only contain lowercase letters, numbers, and hyphens"),
  fileName: z.string().min(1, "File name is required")
});

export type GetFilesQuery = z.infer<typeof getFilesQuerySchema>;
export type UploadFileInput = z.infer<typeof uploadFileSchema>;
export type UpdateFileInput = z.infer<typeof updateFileSchema>;
export type FileParams = z.infer<typeof fileParamsSchema>; 