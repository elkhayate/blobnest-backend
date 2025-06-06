import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/\d/, 'Password must contain at least one number'),
  displayName: z.string().min(1, 'Display name is required'),
  companyName: z.string().min(1, 'Company name is required'),
  companyId: z.string().min(1, 'Company ID is required'),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const validateSignup = (data: unknown) => {
  return signupSchema.safeParse(data);
}; 