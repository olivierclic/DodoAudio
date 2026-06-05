import appJson from '../app.json';

// Single source of truth: the version field in app.json.
// Imported directly so the value is inlined at build time and survives any
// runtime quirk with expo-constants.
export const APP_VERSION: string = (appJson as { expo: { version: string } }).expo.version;
