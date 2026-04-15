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

export interface AppFeatureCollectionLayer extends Schema.Component {
  collectionName: 'components_app_feature_collection_layers';
  info: {
    displayName: 'Feature Collection Layer';
  };
  attributes: {
    circleOpacity: Attribute.Decimal &
      Attribute.Required &
      Attribute.DefaultTo<0.9>;
    circleRadius: Attribute.Decimal &
      Attribute.Required &
      Attribute.DefaultTo<6>;
    negativeColor: Attribute.String &
      Attribute.Required &
      Attribute.DefaultTo<'#ea580c'>;
    positiveColor: Attribute.String &
      Attribute.Required &
      Attribute.DefaultTo<'#0284c7'>;
    strokeColor: Attribute.String &
      Attribute.Required &
      Attribute.DefaultTo<'#ffffff'>;
    strokeWidth: Attribute.Decimal &
      Attribute.Required &
      Attribute.DefaultTo<1.5>;
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

export interface PreferencesProfileSettings extends Schema.Component {
  collectionName: 'components_preferences_profile_settings';
  info: {
    displayName: 'Profile Settings';
  };
  attributes: {
    avatar: Attribute.Media<'images'>;
    birthdate: Attribute.Date;
    firstName: Attribute.String;
    institution: Attribute.String;
    lastName: Attribute.String;
    profession: Attribute.String;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'app.default-appearance': AppDefaultAppearance;
      'app.default-map': AppDefaultMap;
      'app.feature-collection-layer': AppFeatureCollectionLayer;
      'preferences.alert-settings': PreferencesAlertSettings;
      'preferences.appearance-settings': PreferencesAppearanceSettings;
      'preferences.map-settings': PreferencesMapSettings;
      'preferences.profile-settings': PreferencesProfileSettings;
    }
  }
}
