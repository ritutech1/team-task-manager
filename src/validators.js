const { z } = require("zod");

const email = z.string().trim().email().max(255).transform((value) => value.toLowerCase());

const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  password: z.string().min(8).max(100),
  role: z.enum(["ADMIN", "MEMBER"]).optional()
});

const loginSchema = z.object({
  email,
  password: z.string().min(1)
});

const projectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().default("")
});

const memberSchema = z.object({
  userId: z.number().int().positive()
});

const taskSchema = z.object({
  projectId: z.number().int().positive(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional().default(""),
  assignedTo: z.number().int().positive().nullable().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional().default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional().default("MEDIUM"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
});

const taskUpdateSchema = taskSchema.partial().omit({ projectId: true });

function validate(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }));
    const error = new Error("Validation failed");
    error.status = 400;
    error.details = details;
    throw error;
  }
  return result.data;
}

module.exports = {
  signupSchema,
  loginSchema,
  projectSchema,
  memberSchema,
  taskSchema,
  taskUpdateSchema,
  validate
};
