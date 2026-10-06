export interface IIdGenerator {
  next(): string;
}

export interface IClock {
  now(): Date;
}
