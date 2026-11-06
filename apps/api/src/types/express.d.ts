export interface AuthenticatedUser {
  id: string;
  githubId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      /** UUID assigned by the request-logger middleware, present on every request. */
      correlationId?: string;
    }
  }
}
