/**
 * Compile-time proof that a switch covered every variant of a union.
 *
 * Placed in the `default` arm: if a new variant is added and left unhandled,
 * the residual type is no longer `never` and `tsc` fails at the call site
 * rather than the renderer silently drawing nothing.
 */
export const assertNever = (value: never, what: string): never => {
  throw new Error(`${what}: unhandled ${JSON.stringify(value)}`);
};
