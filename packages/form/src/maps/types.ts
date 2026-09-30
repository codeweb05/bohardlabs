/** What `LocationSearchField` stores: a point and something to show for it. */
export interface Place {
  readonly id: string;
  readonly label: string;
  readonly lat: number;
  readonly lng: number;
}

/** What `AddressField` stores. Every part is a string so each renders as a text field. */
export interface Address {
  readonly line1: string;
  readonly line2: string;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string;
  /** ISO 3166-1 alpha-2 when it came from a provider; whatever the user typed otherwise. */
  readonly country: string;
}

/** For `defaultValues`. */
export const EMPTY_ADDRESS: Address = {line1: '', line2: '', city: '', region: '', postalCode: '', country: ''};

export interface PlaceSuggestion {
  readonly id: string;
  readonly label: string;
  readonly secondary?: string;
}

export interface ResolvedPlace extends Place {
  readonly address: Address;
}

/**
 * The geocoder behind the maps fields. `createGooglePlacesProvider` is one; a test fake or
 * another service is another.
 */
export interface PlacesProvider {
  /** Starts a billing session. Called on the first keystroke of a search. */
  newSession(): object;
  suggest(
    query: string,
    options: {readonly signal: AbortSignal; readonly session: object},
  ): Promise<readonly PlaceSuggestion[]>;
  /** Ends the session the suggestion came from. Rejects when the place cannot be resolved. */
  resolve(id: string, options: {readonly session: object}): Promise<ResolvedPlace>;
}
