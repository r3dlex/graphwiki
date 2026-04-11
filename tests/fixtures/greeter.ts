/** Simple greeter module. */

export interface GreeterOptions {
  greeting: string;
}

export class Greeter {
  private greeting: string;

  constructor(options: GreeterOptions) {
    this.greeting = options.greeting;
  }

  public greet(name: string): string {
    return `${this.greeting}, ${name}!`;
  }
}

export function freeFunction(name: string): string {
  return `Hello, ${name}`;
}
