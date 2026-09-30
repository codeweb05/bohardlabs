/// <reference types="google.maps" />
/**
 * Compile-time only (excluded from the build and from the test run). Fails `pnpm
 * typecheck` if a `@types/google.maps` release changes a member `createGooglePlacesProvider`
 * relies on. Fix `GooglePlaces` to match; never cast here.
 */
import type {GooglePlaces} from './googlePlaces.js';

declare const library: google.maps.PlacesLibrary;
export const fits: GooglePlaces = library;
