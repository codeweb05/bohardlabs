import {useId} from 'react';
import type {ReactNode} from 'react';

import {useAppName} from './appName.js';
import {Seg} from './controls.js';
import {Icon} from './Icon.js';
import {useStrings} from './strings.js';
import type {ThemeChoice} from './useTheme.js';

/**
 * The app's brand, the title and the environment, so a staging tab is not taken for dev;
 * then `tools` (where test mode puts its switch), the language when there is a choice, and
 * the theme.
 */
export function Header({
  environment,
  locales,
  locale,
  theme,
  onLanguage,
  onTheme,
  tools,
}: Readonly<{
  environment: string | null | undefined;
  locales: readonly string[];
  locale: string;
  theme: ThemeChoice;
  onLanguage: (locale: string) => void;
  onTheme: (theme: ThemeChoice) => void;
  tools?: ReactNode;
}>) {
  const strings = useStrings();
  const appName = useAppName();
  const languageId = useId();
  return (
    <header className="np-header">
      <span className="np-brand">
        <span className="np-mark" aria-hidden="true" />
        <span>{appName}</span>
      </span>
      <span className="np-sep" aria-hidden="true" />
      <h1 className="np-title">{strings.title}</h1>
      {environment === undefined || environment === null || environment === '' ? null : (
        <span className="np-env">{environment}</span>
      )}
      <span className="np-spacer" />
      {tools}
      {locales.length > 1 ? (
        <>
          <label htmlFor={languageId} className="np-visually-hidden">
            {strings.language}
          </label>
          <select
            id={languageId}
            className="np-select"
            value={locale}
            onChange={(event) => {
              onLanguage(event.target.value);
            }}
          >
            {locales.map((code) => (
              <option key={code} value={code}>
                {strings.languageName(code)}
              </option>
            ))}
          </select>
        </>
      ) : null}
      <Seg<ThemeChoice>
        legend={strings.theme}
        value={theme}
        onChange={onTheme}
        iconOnly
        options={[
          {value: 'light', label: strings.themeLight, icon: <Icon name="sun" />},
          {value: 'auto', label: strings.themeAuto, icon: <Icon name="half" />},
          {value: 'dark', label: strings.themeDark, icon: <Icon name="moon" />},
        ]}
      />
    </header>
  );
}
