/**
 * Turns whatever a transport threw into a string the table can render.
 *
 * It lives apart from `./hooks` on purpose. `hooks.ts` imports React Query at the top
 * level, so anything that pulls `getErrorMessage` from there drags the peer in with it.
 * `useInlineEdit` needs the message and nothing else, and it must stay installable
 * without React Query.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Something went wrong';
}
