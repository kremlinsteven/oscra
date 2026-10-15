/*
 * Browser storage keys. Deliberately neutral (not the brand name), so renaming the project never
 * orphans what visitors' browsers already hold: alerts, practice positions, display settings.
 */
const PREFIX = "os1";
export const storageKey = (...parts: string[]) => [PREFIX, ...parts].join(".");
