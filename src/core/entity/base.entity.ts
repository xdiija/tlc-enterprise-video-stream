export type BaseEntityProps = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Fields every entity has: an id and its timestamps. */
export abstract class BaseEntity {
  protected readonly id: BaseEntityProps['id'];
  protected createdAt: BaseEntityProps['createdAt'];
  protected updatedAt: BaseEntityProps['updatedAt'];

  // Each subclass assigns its own fields in its constructor. `Object.assign(this, data)` here
  // would not work: with ES2022+ class fields, a subclass's declared fields are reset to
  // `undefined` right after `super()` returns.
  constructor(data: BaseEntityProps) {
    this.id = data.id;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  abstract serialize(): Record<string, unknown>;

  getId(): string {
    return this.id;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }
}
