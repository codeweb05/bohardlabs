import {useStrings} from '../../strings.js';
import type {TestState} from '../testedStore.js';

const GLYPHS: Readonly<Record<TestState, string>> = {tested: '✓', retest: '↻', untested: ''};

/**
 * A list item's mark in test mode. It sits inside the item's button, so it is text and nothing
 * to focus: the glyph is only drawn, and the label reads as part of the button's name.
 */
export function StateMark({state}: Readonly<{state: TestState}>) {
  const strings = useStrings();
  const label = {tested: strings.stateTested, retest: strings.stateRetest, untested: strings.stateUntested}[state];
  return (
    <span className="np-state" data-state={state} title={label}>
      <span aria-hidden="true">{GLYPHS[state]}</span>
      <span className="np-visually-hidden">{label}</span>
    </span>
  );
}
