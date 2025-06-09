import { z } from 'zod';

const baseUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  display_name: z.string().min(2, "Display name must be at least 2 characters").max(50, "Display name cannot exceed 50 characters"),
});

export const createUserSchema = baseUserSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password cannot exceed 100 characters"),
  role: z.enum(["admin", "uploader", "viewer"], {
    errorMap: () => ({ message: "Role must be either 'admin', 'uploader', or 'viewer'" }),
  }),
});

export const updateUserSchema = baseUserSchema.partial().extend({
  role: z.enum(["admin", "uploader", "viewer"], {
    errorMap: () => ({ message: "Role must be either 'admin', 'uploader', or 'viewer'" }),
  }).optional(),
});

export const getUsersQuerySchema = z.object({
  search: z.string().max(100, "Search query cannot exceed 100 characters").optional(),
  role: z.enum(["all", "admin", "uploader", "viewer"], {
    errorMap: () => ({ message: "Role must be either 'all', 'admin', 'uploader', or 'viewer'" }),
  }).optional(),
  page: z.coerce.number().int().positive().default(1),
  rowsPerPage: z.coerce.number().int().positive().default(10),
});

export const userIdParamsSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});

export const updateUserInfoSchema = baseUserSchema.partial();

export const updateCompanyInfoSchema = z.object({
  storage_account_name: z.string().min(2, "Storage account name must be at least 2 characters").max(24, "Storage account name cannot exceed 24 characters"),
  sas_token: z.string().min(2, "SAS token must be at least 2 characters").max(512, "SAS token cannot exceed 512 characters"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type GetUsersQuery = z.infer<typeof getUsersQuerySchema>;
export type UserIdParams = z.infer<typeof userIdParamsSchema>; 