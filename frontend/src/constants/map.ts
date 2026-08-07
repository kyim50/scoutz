/**
 * Mapbox public access token.
 *
 * In EAS builds: set EXPO_PUBLIC_MAPBOX_TOKEN as an EAS project secret.
 *   eas secret:create --scope project --name EXPO_PUBLIC_MAPBOX_TOKEN --value "pk.xxx"
 *
 * Metro bakes EXPO_PUBLIC_* vars into the JS bundle at build time, so this
 * resolves correctly in development (via .env) and in production (via EAS secret).
 */
export const MAPBOX_TOKEN: string = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';

/**
 * Mapbox Standard style — used for both light and dark modes.
 * Light preset vs night preset is controlled via StyleImport config inside MapView.
 */
export const MAPBOX_STYLE_STANDARD = 'mapbox://styles/mapbox/standard';

/**
 * Styles for the Static Images API, which renders the thumbnails on the create
 * form and in Activity.
 *
 * These are not the style the live map uses. `mapbox/standard` cannot be
 * rendered by the Static Images API at all — it returns 400 "Unsupported
 * rasterarray tileset format: mapbox.mapbox-landmark-icons-v1", because the
 * style imports tilesets the raster renderer does not handle. The navigation
 * pair is the closest thing available that does render: like Standard's night
 * preset it keeps the road network legible on a blue-cast base, rather than
 * the flat neutral grey of dark-v11.
 */
export const STATIC_MAP_STYLE_NIGHT = 'navigation-night-v1';
export const STATIC_MAP_STYLE_DAY = 'navigation-day-v1';
