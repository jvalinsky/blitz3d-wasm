/**
 * Compilation timeout wrapper
 * 
 * Prevents runaway compilations from freezing the browser
 */

export class CompilationTimeout extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompilationTimeout';
  }
}

/**
 * Run a function with a timeout
 * 
 * @param fn Function to run
 * @param timeoutMs Timeout in milliseconds (default: 5000)
 * @returns Result of the function
 * @throws CompilationTimeout if the function takes too long
 */
export async function withTimeout<T>(
  fn: () => T,
  timeoutMs: number = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new CompilationTimeout(`Compilation exceeded ${timeoutMs}ms timeout`));
    }, timeoutMs);

    try {
      const result = fn();
      clearTimeout(timeoutId);
      resolve(result);
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}

/**
 * Synchronous timeout checker
 * Use by checking periodically in long-running loops
 */
export class TimeoutChecker {
  private startTime: number;
  private timeoutMs: number;

  constructor(timeoutMs: number = 5000) {
    this.startTime = Date.now();
    this.timeoutMs = timeoutMs;
  }

  check(): void {
    if (Date.now() - this.startTime > this.timeoutMs) {
      throw new CompilationTimeout(`Operation exceeded ${this.timeoutMs}ms timeout`);
    }
  }

  elapsed(): number {
    return Date.now() - this.startTime;
  }
}
