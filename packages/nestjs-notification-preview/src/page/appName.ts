import {createContext, useContext} from 'react';

/** The app's name, as the page's `appName` prop gives it. */
export const AppNameContext = createContext('');

/** The app's name, for the brand, the inbox header and the phone. */
export const useAppName = (): string => useContext(AppNameContext);

/** The first letter of the app's name, upper-cased, for an avatar. */
export const initialOf = (name: string): string => [...name.trim()].at(0)?.toUpperCase() ?? '';
