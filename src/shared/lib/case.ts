/**
 * API(snake_case) ↔ UI(camelCase) 변환. 최상위 키만 바꾼다.
 * 중첩된 자유 형식 JSON(input, output, config, definition 등)은 사용자 키가 섞여 있어 건드리지 않는다.
 */
export type SnakeToCamel<S extends string> = S extends `${infer H}_${infer T}`
  ? `${H}${Capitalize<SnakeToCamel<T>>}`
  : S;
export type CamelToSnake<S extends string> = S extends `${infer H}${infer T}`
  ? `${H extends Lowercase<H> ? H : `_${Lowercase<H>}`}${CamelToSnake<T>}`
  : S;

export type CamelKeys<T> = { [K in keyof T as K extends string ? SnakeToCamel<K> : K]: T[K] };
export type SnakeKeys<T> = { [K in keyof T as K extends string ? CamelToSnake<K> : K]: T[K] };

export function toCamelKey(k: string) {
  return k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}
export function toSnakeKey(k: string) {
  return k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function camelKeys<T extends object>(row: T): CamelKeys<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[toCamelKey(k)] = v;
  return out as CamelKeys<T>;
}

export function snakeKeys<T extends object>(obj: T): SnakeKeys<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[toSnakeKey(k)] = v;
  return out as SnakeKeys<T>;
}
