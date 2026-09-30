import type {Address, PlaceSuggestion, PlacesProvider, ResolvedPlace} from './types';

/*
 * The members of Google's Places library this file calls, described structurally so the
 * published types do not depend on Google's type package. `googlePlaces.typetest.ts`
 * checks that the real library still fits.
 */
interface GoogleText {
  readonly text: string;
}

interface GoogleAddressComponent {
  readonly longText: string | null;
  readonly shortText: string | null;
  readonly types: readonly string[];
}

export interface GooglePlace {
  readonly id: string;
  readonly formattedAddress?: string | null;
  readonly location?: {lat(): number; lng(): number} | null;
  readonly addressComponents?: readonly GoogleAddressComponent[] | null;
  fetchFields(options: {fields: string[]}): Promise<{place: GooglePlace}>;
}

interface GooglePlacePrediction {
  readonly placeId: string;
  readonly text: GoogleText;
  readonly mainText: GoogleText | null;
  readonly secondaryText: GoogleText | null;
  toPlace(): GooglePlace;
}

/** The part of the Places library `createGooglePlacesProvider` uses. */
export interface GooglePlaces {
  readonly AutocompleteSessionToken: new () => object;
  readonly Place: new (options: {id: string}) => GooglePlace;
  readonly AutocompleteSuggestion: {
    fetchAutocompleteSuggestions(request: {
      input: string;
      sessionToken?: object;
      includedRegionCodes?: string[];
    }): Promise<{suggestions: readonly {readonly placePrediction: GooglePlacePrediction | null}[]}>;
  };
}

export interface GooglePlacesOptions {
  /** Up to 15 CLDR region codes (`['de', 'at']`) to restrict suggestions to. */
  readonly includedRegionCodes?: readonly string[];
}

const PLACE_FIELDS = ['addressComponents', 'location', 'formattedAddress'];

/**
 * A `PlacesProvider` on the Places API (New). Load the Places library yourself and pass it in:
 *
 *   const places = await importLibrary('places');
 *   const provider = createGooglePlacesProvider(places);
 */
export function createGooglePlacesProvider(places: GooglePlaces, options: GooglePlacesOptions = {}): PlacesProvider {
  // Predictions from a session, kept so `resolve` can call `toPlace()`, which carries the
  // session token into the details request and closes the session for billing.
  const predictions = new WeakMap<object, Map<string, GooglePlacePrediction>>();

  return {
    newSession: () => new places.AutocompleteSessionToken(),

    async suggest(query, {signal, session}) {
      const {suggestions} = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query,
        sessionToken: session,
        includedRegionCodes: options.includedRegionCodes ? [...options.includedRegionCodes] : undefined,
      });
      // Google's call takes no signal. The request still completes; its answer is dropped.
      signal.throwIfAborted();

      const cache = predictions.get(session) ?? new Map<string, GooglePlacePrediction>();
      predictions.set(session, cache);
      return suggestions.flatMap(({placePrediction: prediction}): PlaceSuggestion[] => {
        if (!prediction) return [];
        cache.set(prediction.placeId, prediction);
        return [
          {
            id: prediction.placeId,
            label: prediction.mainText?.text ?? prediction.text.text,
            secondary: prediction.secondaryText?.text,
          },
        ];
      });
    },

    async resolve(id, {session}): Promise<ResolvedPlace> {
      const place = predictions.get(session)?.get(id)?.toPlace() ?? new places.Place({id});
      const {place: detailed} = await place.fetchFields({fields: PLACE_FIELDS});
      // A point is the whole reason for the lookup. Without one, fail rather than store 0, 0.
      if (!detailed.location) throw new Error(`@vt-labs/form: Google returned place ${id} without a location.`);
      return {
        id,
        label: detailed.formattedAddress ?? '',
        lat: detailed.location.lat(),
        lng: detailed.location.lng(),
        address: toAddress(detailed.addressComponents ?? []),
      };
    },
  };
}

function toAddress(components: readonly GoogleAddressComponent[]): Address {
  const part = (type: string, form: 'longText' | 'shortText' = 'longText') =>
    components.find((component) => component.types.includes(type))?.[form] ?? '';
  return {
    line1: [part('street_number'), part('route')].filter(Boolean).join(' ') || part('premise'),
    line2: part('subpremise'),
    city: part('locality') || part('postal_town') || part('administrative_area_level_2'),
    region: part('administrative_area_level_1'),
    postalCode: part('postal_code'),
    country: part('country', 'shortText'),
  };
}
