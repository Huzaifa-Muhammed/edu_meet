import { z } from "zod";

export const UserUpdateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  subjects: z.array(z.string()).optional(),
  photoUrl: z.string().url().optional(),
});

export const UserCreateSchema = z.object({
  uid: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1).max(100),
  role: z.enum(["teacher", "student", "parent", "admin"]),
  photoUrl: z.string().url().optional(),
});

export type UserUpdateInput = z.infer<typeof UserUpdateSchema>;
export type UserCreateInput = z.infer<typeof UserCreateSchema>;
