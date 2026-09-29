import {firstIssue} from './issues';

describe('firstIssue', () => {
  it('wraps a string error as an issue', () => {
    expect(firstIssue(['Required'])).toEqual({message: 'Required'});
  });

  it('returns the first issue object, skipping empty and unknown entries', () => {
    const issue = {message: 'Too short', path: ['name']};
    expect(firstIssue([undefined, '', {code: 'x'}, issue, 'later'])).toBe(issue);
  });

  it('looks one level into arrays, which is how schema validators report', () => {
    expect(firstIssue([[{message: 'Invalid email'}]])).toEqual({message: 'Invalid email'});
  });

  it('returns null when nothing is an error', () => {
    expect(firstIssue([undefined, null, ''])).toBeNull();
  });
});
