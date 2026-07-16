/**
 * The phrase that confirms an account deletion.
 *
 * It lives here rather than in account.ts because a "use server" module may
 * only export async functions — exporting a const from it silently strips every
 * export in the module, action included. Both the dialog that asks for the
 * phrase and the action that re-checks it import it from here, so they can
 * never drift apart.
 */
export const DELETE_CONFIRMATION = "delete my account";
