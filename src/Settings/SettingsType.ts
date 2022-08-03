export type SettingsManagersType = 'graph' | 'explorer' | 'header' | 'quick_switcher'
export type SettingsType = {
    path: string,
    rules: {
      paths: {mode: 'black'|'white', values: string[]}
    },
    managers: { [k in SettingsManagersType]: boolean }
};

export type SettingsEvent = {
    'settings.changed': SettingsType
}