import type { Attribute, Schema } from '@strapi/strapi';

export interface AppDefaultAppearance extends Schema.Component {
  collectionName: 'components_app_default_appearances';
  info: {
    displayName: 'Default Appearance';
  };
  attributes: {
    language: Attribute.Enumeration<['pt-BR', 'en', 'es', 'fr']> &
      Attribute.Required &
      Attribute.DefaultTo<'pt-BR'>;
  };
}

export interface AppDefaultMap extends Schema.Component {
  collectionName: 'components_app_default_maps';
  info: {
    displayName: 'Default Map';
  };
  attributes: {
    centerLatitude: Attribute.Decimal &
      Attribute.Required &
      Attribute.DefaultTo<-15>;
    centerLongitude: Attribute.Decimal &
      Attribute.Required &
      Attribute.DefaultTo<-52>;
    defaultZoom: Attribute.Decimal &
      Attribute.Required &
      Attribute.DefaultTo<4>;
    mapStyle: Attribute.Enumeration<
      ['outdoors', 'streets', 'satellite', 'dark']
    > &
      Attribute.Required &
      Attribute.DefaultTo<'outdoors'>;
  };
}

export interface PreferencesAlertSettings extends Schema.Component {
  collectionName: 'components_preferences_alert_settings';
  info: {
    displayName: 'Alert Settings';
  };
  attributes: {
    dailyDigest: Attribute.Boolean & Attribute.DefaultTo<false>;
    dashboardNotifications: Attribute.Boolean & Attribute.DefaultTo<true>;
    emailNotifications: Attribute.Boolean & Attribute.DefaultTo<false>;
    enabled: Attribute.Boolean & Attribute.DefaultTo<false>;
    favoritesOnly: Attribute.Boolean & Attribute.DefaultTo<true>;
    forecastThresholdAlerts: Attribute.Boolean & Attribute.DefaultTo<true>;
    leadTimeMinutes: Attribute.Integer &
      Attribute.Required &
      Attribute.DefaultTo<60>;
    minimumSeverity: Attribute.Enumeration<['info', 'warning', 'critical']> &
      Attribute.Required &
      Attribute.DefaultTo<'warning'>;
    stationOfflineAlerts: Attribute.Boolean & Attribute.DefaultTo<true>;
  };
}

export interface PreferencesAppearanceSettings extends Schema.Component {
  collectionName: 'components_preferences_appearance_settings';
  info: {
    displayName: 'Appearance Settings';
  };
  attributes: {
    language: Attribute.Enumeration<['pt-BR', 'en', 'es', 'fr']> &
      Attribute.Required &
      Attribute.DefaultTo<'pt-BR'>;
    theme: Attribute.Enumeration<['light', 'dark', 'system']> &
      Attribute.Required &
      Attribute.DefaultTo<'system'>;
    timeZone: Attribute.String &
      Attribute.Required &
      Attribute.DefaultTo<'America/Sao_Paulo'>;
  };
}

export interface PreferencesMapSettings extends Schema.Component {
  collectionName: 'components_preferences_map_settings';
  info: {
    displayName: 'Map Settings';
  };
  attributes: {
    centerLatitude: Attribute.Decimal &
      Attribute.Required &
      Attribute.DefaultTo<-15>;
    centerLongitude: Attribute.Decimal &
      Attribute.Required &
      Attribute.DefaultTo<-52>;
    defaultZoom: Attribute.Decimal &
      Attribute.Required &
      Attribute.DefaultTo<4>;
    mapStyle: Attribute.Enumeration<
      ['outdoors', 'streets', 'satellite', 'dark']
    > &
      Attribute.Required &
      Attribute.DefaultTo<'outdoors'>;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'app.default-appearance': AppDefaultAppearance;
      'app.default-map': AppDefaultMap;
      'preferences.alert-settings': PreferencesAlertSettings;
      'preferences.appearance-settings': PreferencesAppearanceSettings;
      'preferences.map-settings': PreferencesMapSettings;
    }
  }
}
