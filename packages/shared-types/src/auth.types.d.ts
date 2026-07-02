export type UserRole = "ENGINEER" | "OPERATOR" | "MAINTENANCE_MANAGER" | "SAFETY_OFFICER" | "ADMINISTRATOR" | "TRAINING_OFFICER";
export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    status: "ACTIVE" | "INACTIVE";
    createdAt: string;
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}
export interface LoginResponse {
    user: User;
    tokens: AuthTokens;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface JwtPayload {
    sub: string;
    email: string;
    role: UserRole;
    iat?: number;
    exp?: number;
}
