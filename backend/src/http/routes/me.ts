import { Hono } from "hono";
import { currentSession, type SessionDeps } from "../auth-context.ts";
import { toMe } from "../serialize.ts";

export function meRoutes(deps: SessionDeps) {
  const app = new Hono();

  app.get("/me", async (c) => {
    const { user, store } = await currentSession(c, deps);
    return c.json(toMe(user, store));
  });

  return app;
}
