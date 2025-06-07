import { z } from 'zod';

// Base user schema with common fields
const baseUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  display_name: z.string().min(2, "Display name must be at least 2 characters"),
});

// Create user schema
export const createUserSchema = baseUserSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "uploader", "viewer"], {
    errorMap: () => ({ message: "Role must be either 'admin', 'uploader', or 'viewer'" }),
  }),
});

// Update user schema (all fields optional)
export const updateUserSchema = baseUserSchema.partial().extend({
  role: z.enum(["admin", "uploader", "viewer"], {
    errorMap: () => ({ message: "Role must be either 'admin', 'uploader', or 'viewer'" }),
  }).optional(),
});

// Query parameters schema for getUsers
export const getUsersQuerySchema = z.object({
  search: z.string().optional(),
  role: z.enum(["all", "admin", "uploader", "viewer"], {
    errorMap: () => ({ message: "Role must be either 'all', 'admin', 'uploader', or 'viewer'" }),
  }).optional(),
  page: z.coerce.number().int().positive().default(1),
  rowsPerPage: z.coerce.number().int().positive().default(10),
});

// Params schema for user ID
export const userIdParamsSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});

// Type exports
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type GetUsersQuery = z.infer<typeof getUsersQuerySchema>;
export type UserIdParams = z.infer<typeof userIdParamsSchema>; 