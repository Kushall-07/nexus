export interface AuthenticatedUser {
  id: string;
  githubId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
