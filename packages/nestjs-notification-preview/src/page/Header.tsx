import {useId} from 'react';

import {Seg} from './controls.js';
import {Icon} from './Icon.js';
import {useStrings} from './strings.js';
import type {ThemeChoice} from './useTheme.js';

export function Header({
  environment,
  locales,
  locale,
  theme,
  onLanguage,
  onTheme,
}: Readonly<{
  environment: string | undefined;
  locales: readonly string[];
  locale: string;
  theme: ThemeChoice;
  onLanguage: (locale: string) => void;
  onTheme: (theme: ThemeChoice) => void;
}>) {
  const strings = useStrings();
  const languageId = useId();
  return (
    <div className="np-header">
      <h1 className="np-title">{strings.title}</h1>
      {environment === undefined ? null : <span className="np-pill">{environment}</span>}
      <div className="np-header-tools">
        {locales.length > 1 ? (
          <div className="np-language">
            <label htmlFor={languageId}>{strings.language}</label>
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
          </div>
        ) : null}
        <Seg<ThemeChoice>
          legend={strings.theme}
          value={theme}
          onChange={onTheme}
          options={[
            {value: 'light', label: strings.themeLight, icon: <Icon name="sun" />},
            {value: 'auto', label: strings.themeAuto, icon: <Icon name="half" />},
            {value: 'dark', label: strings.themeDark, icon: <Icon name="moon" />},
          ]}
        />
      </div>
    </div>
  );
}
