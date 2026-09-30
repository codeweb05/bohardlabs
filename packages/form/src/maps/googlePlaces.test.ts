import {createGooglePlacesProvider} from './googlePlaces.js';
import type {GooglePlace, GooglePlaces} from './googlePlaces.js';

function unexpectedPlace(): never {
  throw new Error('resolve should use the cached prediction, not a new Place');
}

function fakeGoogle({location = {lat: () => 52.517, lng: () => 13.389}}: Pick<GooglePlace, 'location'> = {}) {
  const requests: {input: string; sessionToken?: object; includedRegionCodes?: string[]}[] = [];
  const fetchedFields: string[][] = [];

  const berlinPlace: GooglePlace = {
    id: 'berlin-1',
    formattedAddress: 'Unter den Linden 1, 10117 Berlin, Germany',
    location,
    addressComponents: [
      {longText: '1', shortText: '1', types: ['street_number']},
      {longText: 'Unter den Linden', shortText: 'Unter den Linden', types: ['route']},
      {longText: 'Berlin', shortText: 'Berlin', types: ['locality', 'political']},
      {longText: 'Berlin', shortText: 'BE', types: ['administrative_area_level_1', 'political']},
      {longText: '10117', shortText: '10117', types: ['postal_code']},
      {longText: 'Germany', shortText: 'DE', types: ['country', 'political']},
    ],
    fetchFields: async ({fields}) => {
      fetchedFields.push(fields);
      return {place: berlinPlace};
    },
  };

  const google: GooglePlaces = {
    AutocompleteSessionToken: class {
      readonly token = true;
    },
    Place: class {
      readonly id = '';
      fetchFields = unexpectedPlace;
      constructor() {
        unexpectedPlace();
      }
    },
    AutocompleteSuggestion: {
      fetchAutocompleteSuggestions: async (request) => {
        requests.push(request);
        return {
          suggestions: [
            {
              placePrediction: {
                placeId: 'berlin-1',
                text: {text: 'Unter den Linden 1, Berlin, Germany'},
                mainText: {text: 'Unter den Linden 1'},
                secondaryText: {text: 'Berlin, Germany'},
                toPlace: () => berlinPlace,
              },
            },
            {placePrediction: null},
          ],
        };
      },
    },
  };
  return {google, requests, fetchedFields};
}

describe('createGooglePlacesProvider', () => {
  it('turns predictions into suggestions, passing the session and region filter', async () => {
    const {google, requests} = fakeGoogle();
    const provider = createGooglePlacesProvider(google, {includedRegionCodes: ['de']});
    const session = provider.newSession();

    const suggestions = await provider.suggest('unter', {signal: new AbortController().signal, session});

    expect(suggestions).toEqual([{id: 'berlin-1', label: 'Unter den Linden 1', secondary: 'Berlin, Germany'}]);
    expect(requests[0]).toMatchObject({input: 'unter', sessionToken: session, includedRegionCodes: ['de']});
  });

  it('resolves through the cached prediction and maps the address', async () => {
    const {google, fetchedFields} = fakeGoogle();
    const provider = createGooglePlacesProvider(google);
    const session = provider.newSession();
    await provider.suggest('unter', {signal: new AbortController().signal, session});

    const place = await provider.resolve('berlin-1', {session});

    expect(fetchedFields[0]).toEqual(['addressComponents', 'location', 'formattedAddress']);
    expect(place).toEqual({
      id: 'berlin-1',
      label: 'Unter den Linden 1, 10117 Berlin, Germany',
      lat: 52.517,
      lng: 13.389,
      address: {
        line1: '1 Unter den Linden',
        line2: '',
        city: 'Berlin',
        region: 'Berlin',
        postalCode: '10117',
        country: 'DE',
      },
    });
  });

  it('rejects a place that comes back without a location, rather than placing it at 0, 0', async () => {
    const {google} = fakeGoogle({location: null});
    const provider = createGooglePlacesProvider(google);
    const session = provider.newSession();
    await provider.suggest('unter', {signal: new AbortController().signal, session});

    await expect(provider.resolve('berlin-1', {session})).rejects.toThrow('berlin-1');
  });

  it('rejects when the request was aborted while Google answered', async () => {
    const {google} = fakeGoogle();
    const provider = createGooglePlacesProvider(google);
    const controller = new AbortController();
    const pending = provider.suggest('unter', {signal: controller.signal, session: provider.newSession()});
    controller.abort();
    await expect(pending).rejects.toBeDefined();
  });
});
