export const assert: (cond: unknown, msg?: string) => void = (
  cond: unknown,
  msg = "Assertion failed",
) => {
  if (!cond) throw new Error(msg);
};

export const assertEquals = <T>(a: T, b: T, msg?: string) => {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  if (ja !== jb) {
    throw new Error(msg ?? `assertEquals failed:\n  a=${ja}\n  b=${jb}`);
  }
};
