import { SetMetadata } from "@nestjs/common";

export type UserRole =
  | "ENGINEER"
  | "OPERATOR"
  | "MAINTENANCE_MANAGER"
  | "SAFETY_OFFICER"
  | "ADMINISTRATOR"
  | "TRAINING_OFFICER";

export const ROLES_KEY = "roles";
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
