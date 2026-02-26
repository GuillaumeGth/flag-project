export function log(context: string, ...args: unknown[]): void {
  if (__DEV__) console.log(`[${context}]`, ...args);
}

export function warn(context: string, ...args: unknown[]): void {
  if (__DEV__) console.warn(`[${context}]`, ...args);
}
