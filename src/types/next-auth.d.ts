import { DefaultSession, DefaultUser } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface User extends DefaultUser {
    id: string;
    role: "ADMIN" | "VIEWER";
  }

  interface Session extends DefaultSession {
    user: {
      id: string;
      role: "ADMIN" | "VIEWER";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    role?: "ADMIN" | "VIEWER";
  }
}
