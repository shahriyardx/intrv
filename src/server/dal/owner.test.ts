import { describe, expect, it } from "vitest";
import {
  canAccessSession,
  isAdmin,
  ownerWhere,
  type Viewer,
} from "@/server/dal/owner";

const user: Viewer = { kind: "user", userId: "u1", role: null, banned: false };
const other: Viewer = { kind: "user", userId: "u2", role: null, banned: false };
const anon: Viewer = { kind: "anonymous" };

describe("canAccessSession", () => {
  it("lets anyone with the id read an unowned session", () => {
    // No account required: the unguessable id is the capability.
    expect(canAccessSession({ userId: null }, anon)).toBe(true);
    expect(canAccessSession({ userId: null }, user)).toBe(true);
  });

  it("lets the owner read their own session", () => {
    expect(canAccessSession({ userId: "u1" }, user)).toBe(true);
  });

  it("refuses another signed-in user", () => {
    expect(canAccessSession({ userId: "u1" }, other)).toBe(false);
  });

  it("refuses an anonymous viewer holding an owned session's id", () => {
    // Knowing the id is not enough once a session belongs to someone.
    expect(canAccessSession({ userId: "u1" }, anon)).toBe(false);
  });
});

describe("ownerWhere", () => {
  it("scopes a listing to the signed-in user", () => {
    expect(ownerWhere(user)).toEqual({ userId: "u1" });
  });

  it("returns null — never an empty object — for an anonymous viewer", () => {
    // The dangerous case: spreading {} into a Prisma `where` matches every row.
    const where = ownerWhere(anon);

    expect(where).toBeNull();
    expect(where).not.toEqual({});
  });
});

describe("isAdmin", () => {
  const admin: Viewer = {
    kind: "user",
    userId: "u1",
    role: "admin",
    banned: false,
  };

  it("accepts an unbanned admin", () => {
    expect(isAdmin(admin)).toBe(true);
  });

  it("rejects a banned admin", () => {
    expect(isAdmin({ ...admin, banned: true })).toBe(false);
  });

  it("rejects ordinary users and anonymous viewers", () => {
    expect(isAdmin(user)).toBe(false);
    expect(isAdmin(anon)).toBe(false);
  });
});
