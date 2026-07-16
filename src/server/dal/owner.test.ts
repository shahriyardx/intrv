import { describe, expect, it } from "vitest";
import { isAdmin, ownerWhere, type Viewer } from "@/server/dal/owner";

describe("ownerWhere", () => {
  it("scopes to the user id for a signed-in viewer", () => {
    expect(
      ownerWhere({ kind: "user", userId: "u1", role: null, banned: false }),
    ).toEqual({
      userId: "u1",
    });
  });

  it("scopes to the guest id for a guest viewer", () => {
    expect(ownerWhere({ kind: "guest", guestId: "g_1" })).toEqual({
      guestId: "g_1",
    });
  });

  it("returns null — never an empty object — for an anonymous viewer", () => {
    // This is the dangerous case: spreading {} into a Prisma `where` matches
    // every row in the table. Callers must treat null as "match nothing".
    const where = ownerWhere({ kind: "anonymous" });

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

  it("rejects ordinary users and guests", () => {
    expect(isAdmin({ ...admin, role: "user" })).toBe(false);
    expect(isAdmin({ kind: "guest", guestId: "g_1" })).toBe(false);
    expect(isAdmin({ kind: "anonymous" })).toBe(false);
  });
});
