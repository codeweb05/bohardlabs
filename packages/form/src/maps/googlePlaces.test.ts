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

  describe('with the sparse answers Google gives for some places', () => {
    /** A library whose every place is `fields`, and whose one prediction has no main text. */
    function sparseGoogle(fields: Pick<GooglePlace, 'formattedAddress' | 'addressComponents'>) {
      const created: string[] = [];
      const google: GooglePlaces = {
        AutocompleteSessionToken: class {
          readonly token = true;
        },
        Place: class {
          readonly id: string;
          readonly location = {lat: () => 51.752, lng: () => -1.258};
          readonly formattedAddress = fields.formattedAddress;
          readonly addressComponents = fields.addressComponents;
          constructor({id}: {id: string}) {
            this.id = id;
            created.push(id);
          }
          fetchFields = async () => ({place: this});
        },
        AutocompleteSuggestion: {
          fetchAutocompleteSuggestions: async () => ({
            suggestions: [
              {
                placePrediction: {
                  placeId: 'oxford-1',
                  text: {text: 'Radcliffe Camera, Oxford, UK'},
                  mainText: null,
                  secondaryText: null,
                  toPlace: unexpectedPlace,
                },
              },
            ],
          }),
        },
      };
      return {google, created};
    }

    it('labels a prediction that has no main text with its full text', async () => {
      const provider = createGooglePlacesProvider(sparseGoogle({}).google);
      const suggestions = await provider.suggest('rad', {
        signal: new AbortController().signal,
        session: provider.newSession(),
      });
      expect(suggestions).toEqual([{id: 'oxford-1', label: 'Radcliffe Camera, Oxford, UK', secondary: undefined}]);
    });

    it('resolves an id it never suggested, such as one stored earlier, through a new Place', async () => {
      const {google, created} = sparseGoogle({});
      const provider = createGooglePlacesProvider(google);

      const place = await provider.resolve('stored-7', {session: provider.newSession()});

      expect(created).toEqual(['stored-7']);
      // Google sent neither a formatted address nor components: blanks, not a crash.
      expect(place).toEqual({
        id: 'stored-7',
        label: '',
        lat: 51.752,
        lng: -1.258,
        address: {line1: '', line2: '', city: '', region: '', postalCode: '', country: ''},
      });
    });

    it('uses the building name where there is no street, and the post town where there is no locality', async () => {
      const {google} = sparseGoogle({
        formattedAddress: 'Radcliffe Camera, Oxford OX1 3BG, UK',
        addressComponents: [
          {longText: 'Radcliffe Camera', shortText: 'Radcliffe Camera', types: ['premise']},
          {longText: 'Oxford', shortText: 'Oxford', types: ['postal_town']},
          {longText: 'Oxfordshire', shortText: 'Oxfordshire', types: ['administrative_area_level_2', 'political']},
          {longText: 'OX1 3BG', shortText: 'OX1 3BG', types: ['postal_code']},
          {longText: 'United Kingdom', shortText: 'GB', types: ['country', 'political']},
        ],
      });
      const provider = createGooglePlacesProvider(google);

      const {label, address} = await provider.resolve('oxford-1', {session: provider.newSession()});

      expect(label).toBe('Radcliffe Camera, Oxford OX1 3BG, UK');
      expect(address).toMatchObject({line1: 'Radcliffe Camera', city: 'Oxford', postalCode: 'OX1 3BG', country: 'GB'});
    });

    it('falls back to the county for the city when there is neither a locality nor a post town', async () => {
      const {google} = sparseGoogle({
        addressComponents: [
          {longText: 'Oxfordshire', shortText: 'Oxfordshire', types: ['administrative_area_level_2', 'political']},
          {longText: null, shortText: null, types: ['route']},
        ],
      });
      const provider = createGooglePlacesProvider(google);

      const {address} = await provider.resolve('field-1', {session: provider.newSession()});

      expect(address).toMatchObject({line1: '', city: 'Oxfordshire'});
    });
  });
});
