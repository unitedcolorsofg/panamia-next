/**
 * Shared JSON types
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonArray = JsonValue[];
export type JsonObject = { [key: string]: JsonValue };
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;

/** Alias used for input (identical to JsonValue — kept for migration ease). */
export type InputJsonValue = JsonValue;
