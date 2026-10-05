// Generic object pool: pre-filled at creation, grows on demand, never destroys. Pooled view
// objects are reused instead of being created and destroyed during play.
export class ObjectPool<T> {
  private readonly free: T[] = [];
  private readonly create: () => T;

  constructor(create: () => T, preSize: number) {
    this.create = create;
    for (let i = 0; i < preSize; i++) this.free.push(create());
  }

  acquire(): T {
    return this.free.pop() ?? this.create();
  }

  release(obj: T): void {
    this.free.push(obj);
  }

  get available(): number {
    return this.free.length;
  }
}
