import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as React from 'react';
import {
  LuCloud,
  LuCloudRain,
  LuCloudSun,
  LuDroplets,
  LuGauge,
  LuLocateFixed,
  LuMapPin,
  LuRefreshCw,
  LuSun,
  LuThermometerSun,
  LuWind,
  LuExternalLink,
} from 'react-icons/lu';
import type { WidgetSizePreset } from '../widgetDashboard.types';
import type { WidgetInstance } from '../widgetDashboard.types';
import { widgetPerf } from '../utils/widgetPerf';

type WeatherStatus = 'request-location' | 'loading' | 'ready' | 'permission-denied' | 'error';
type WeatherErrorReason = 'permission-denied' | 'timeout' | 'unavailable' | 'unknown';

class WeatherWidgetError extends Error {
  reason: WeatherErrorReason;

  constructor(message: string, reason: WeatherErrorReason = 'unknown') {
    super(message);
    this.name = 'WeatherWidgetError';
    this.reason = reason;
  }
}

interface WeatherData {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  cloudCover: number;
  pressure: number;
  precipitation: number;
  windSpeed: number;
  windGusts: number;
  weatherCode: number;
  placeLabel: string;
  updatedAtLabel: string;
}

interface WeatherLocation {
  latitude: number;
  longitude: number;
  label: string;
}

const WEATHER_CACHE_KEY = 'cmdos-weather-widget-cache-v4';
const LEGACY_WEATHER_CACHE_KEYS = [
  'cmdos-weather-widget-cache-v1',
  'cmdos-weather-widget-cache-v2',
  'cmdos-weather-widget-cache-v3',
];
const WEATHER_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const LOCATION_BLOCKED_MESSAGE =
  'Chrome is denying location access for this extension page. Enable Location for this page, then retry.';
const LOCATION_PROMPT_NOT_SHOWN_MESSAGE =
  'Chrome did not open the location prompt for this extension page. Use the location control near the address bar, then retry.';

interface WeatherCachePayload {
  weather: WeatherData;
  cachedAt: number;
}

const isValidWeatherData = (weather: Partial<WeatherData> | null | undefined): weather is WeatherData =>
  Boolean(
    weather &&
      Number.isFinite(weather.temperature) &&
      Number.isFinite(weather.apparentTemperature) &&
      Number.isFinite(weather.humidity) &&
      Number.isFinite(weather.cloudCover) &&
      Number.isFinite(weather.pressure) &&
      Number.isFinite(weather.precipitation) &&
      Number.isFinite(weather.windSpeed) &&
      Number.isFinite(weather.windGusts) &&
      Number.isFinite(weather.weatherCode) &&
      typeof weather.placeLabel === 'string' &&
      weather.placeLabel.length > 0 &&
      typeof weather.updatedAtLabel === 'string' &&
      weather.updatedAtLabel.length > 0,
  );

const readWeatherCache = (): WeatherData | null => {
  try {
    if (typeof localStorage === 'undefined') return null;
    LEGACY_WEATHER_CACHE_KEYS.forEach(cacheKey => localStorage.removeItem(cacheKey));
    const rawCache = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!rawCache) return null;

    const parsedCache = JSON.parse(rawCache) as WeatherCachePayload;
    if (!isValidWeatherData(parsedCache?.weather) || Date.now() - parsedCache.cachedAt > WEATHER_REFRESH_INTERVAL_MS) {
      localStorage.removeItem(WEATHER_CACHE_KEY);
      return null;
    }

    return parsedCache.weather;
  } catch {
    localStorage.removeItem(WEATHER_CACHE_KEY);
    return null;
  }
};

const writeWeatherCache = (weather: WeatherData) => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(
      WEATHER_CACHE_KEY,
      JSON.stringify({
        weather,
        cachedAt: Date.now(),
      } satisfies WeatherCachePayload),
    );
  } catch {
    // Cache is only an optimization; weather can still load without it.
  }
};

const getLocationPermissionState = async (): Promise<PermissionState | null> => {
  if (!navigator.permissions?.query) return null;

  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return status.state;
  } catch {
    return null;
  }
};

const getWeatherDescription = (code: number) => {
  if (code === 0) return 'Clear';
  if ([1, 2, 3].includes(code)) return 'Partly cloudy';
  if ([45, 48].includes(code)) return 'Foggy';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Storm';
  return 'Weather';
};

const WeatherIcon = ({ code, size = 30 }: { code: number; size?: number }) => {
  if (code === 0) return <LuSun size={size} />;
  if ([1, 2, 3].includes(code)) return <LuCloudSun size={size} />;
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return <LuCloudRain size={size} />;
  return <LuCloud size={size} />;
};

const formatTimezonePlaceLabel = (timezone: unknown) => {
  if (typeof timezone !== 'string' || !timezone) return 'Current location';
  return timezone.split('/').pop()?.replace(/_/g, ' ') || 'Current location';
};

const formatLocationParts = (...parts: Array<unknown>) =>
  parts
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .filter(
      (part, index, allParts) => allParts.findIndex(value => value.toLowerCase() === part.toLowerCase()) === index,
    )
    .join(', ');

const fetchLocationLabel = async (location: WeatherLocation, fallbackLabel: string) => {
  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${location.latitude}&longitude=${location.longitude}&localityLanguage=en`,
    );
    if (!response.ok) return fallbackLabel;

    const data = await response.json();
    return formatLocationParts(data.city, data.locality, data.principalSubdivision, data.countryName) || fallbackLabel;
  } catch {
    return fallbackLabel;
  }
};

const fetchApproximateLocation = async (): Promise<WeatherLocation> => {
  const response = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=en');
  if (!response.ok) throw new WeatherWidgetError('Unable to detect approximate location.', 'unavailable');

  const data = await response.json();
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new WeatherWidgetError('Approximate location is unavailable.', 'unavailable');
  }

  return {
    latitude,
    longitude,
    label: formatLocationParts(data.city, data.locality, data.principalSubdivision, data.countryName) || 'Current city',
  };
};

const getBrowserLocation = () =>
  new Promise<WeatherLocation>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new WeatherWidgetError('Browser location is unavailable.', 'unavailable'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: 'Current location',
        });
      },
      error => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new WeatherWidgetError(LOCATION_BLOCKED_MESSAGE, 'permission-denied'));
          return;
        }

        if (error.code === error.TIMEOUT) {
          reject(new WeatherWidgetError('Location timed out. Check browser location access and try again.', 'timeout'));
          return;
        }

        reject(new WeatherWidgetError(error.message || 'Unable to get your location.'));
      },
      {
        enableHighAccuracy: false,
        maximumAge: 30 * 60 * 1000,
        timeout: 15000,
      },
    );
  });

const readRequiredNumber = (value: unknown, fieldName: string) => {
  if (value === null || value === undefined || value === '') {
    throw new Error(`Weather response is missing ${fieldName}.`);
  }

  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) throw new Error(`Weather response has invalid ${fieldName}.`);
  return parsedValue;
};

const formatWeatherTime = (value: unknown) => {
  if (typeof value !== 'string') return 'Now';
  const weatherTime = new Date(value);
  return Number.isNaN(weatherTime.getTime())
    ? 'Now'
    : weatherTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const fetchOpenMeteoWeather = async (location: WeatherLocation): Promise<WeatherData> => {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_gusts_10m&temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm&timezone=auto`,
  );
  if (!response.ok) throw new Error('Weather request failed.');

  const data = await response.json();
  const currentWeather = data.current;
  if (!currentWeather) throw new Error('Weather data missing.');

  const fallbackPlaceLabel = location.label || formatTimezonePlaceLabel(data.timezone);
  const placeLabel = await fetchLocationLabel(location, fallbackPlaceLabel);
  const weatherCode = Math.round(readRequiredNumber(currentWeather.weather_code, 'weather code'));

  return {
    temperature: Math.round(readRequiredNumber(currentWeather.temperature_2m, 'temperature')),
    apparentTemperature: Math.round(readRequiredNumber(currentWeather.apparent_temperature, 'feels-like temperature')),
    humidity: Math.round(readRequiredNumber(currentWeather.relative_humidity_2m, 'humidity')),
    cloudCover: Math.round(readRequiredNumber(currentWeather.cloud_cover, 'cloud cover')),
    pressure: Math.round(readRequiredNumber(currentWeather.pressure_msl, 'pressure')),
    precipitation: readRequiredNumber(currentWeather.precipitation, 'precipitation'),
    windSpeed: Math.round(readRequiredNumber(currentWeather.wind_speed_10m, 'wind speed')),
    windGusts: Math.round(readRequiredNumber(currentWeather.wind_gusts_10m, 'wind gusts')),
    weatherCode,
    placeLabel,
    updatedAtLabel: formatWeatherTime(currentWeather.time),
  };
};

import type { WidgetLayoutInfo } from '../utils/widgetLayoutInfo';
import { getWidgetLayoutInfo } from '../utils/widgetLayoutInfo';

interface WeatherWidgetProps {
  widget?: WidgetInstance;
  sizePreset?: WidgetSizePreset;
  layoutInfo?: WidgetLayoutInfo;
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ widget, sizePreset = 'medium', layoutInfo: providedLayoutInfo }) => {
  const layout = providedLayoutInfo || getWidgetLayoutInfo(sizePreset === 'large' ? 12 : sizePreset === 'medium' ? 8 : 4, 5);
  const isLoadingRef = useRef(false);
  const firstContentLoggedRef = useRef(false);
  const cachedWeather = useMemo(() => {
    widgetPerf('cache:read:start', {
      widgetType: widget?.type || 'weather',
      widgetId: widget?.id || 'unknown',
    });
    const startedAt = performance.now();
    const result = readWeatherCache();
    widgetPerf(result ? 'cache:read:hit' : 'cache:read:miss', {
      widgetType: widget?.type || 'weather',
      widgetId: widget?.id || 'unknown',
      durationMs: Math.round(performance.now() - startedAt),
    });
    return result;
  }, [widget?.id, widget?.type]);
  const [weatherState, setWeatherState] = useState<{
    weather: WeatherData | null;
    status: WeatherStatus;
  }>(() => {
    return {
      weather: cachedWeather,
      status: cachedWeather ? 'ready' : 'request-location',
    };
  });
  const { weather, status } = weatherState;
  const hasWeatherRef = useRef(Boolean(weather));
  const [message, setMessage] = useState('Weather unavailable.');

  const setWeather = useCallback((nextWeather: WeatherData | null) => {
    hasWeatherRef.current = Boolean(nextWeather);
    setWeatherState(current => ({
      ...current,
      weather: nextWeather,
    }));
  }, []);

  const setStatus = useCallback((nextStatus: WeatherStatus) => {
    setWeatherState(current => ({
      ...current,
      status: nextStatus,
    }));
  }, []);

  const loadWeather = useCallback(
    async (silent = false, forceBrowserLocation = false) => {
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;
      if (!silent || !hasWeatherRef.current) setStatus('loading');
      setMessage('Weather unavailable.');
      let permissionStateBeforeRequest: PermissionState | null = null;

      try {
        widgetPerf('permission:read:start', {
          widgetType: widget?.type || 'weather',
          widgetId: widget?.id || 'unknown',
        });
        const permissionStartedAt = performance.now();
        permissionStateBeforeRequest = await getLocationPermissionState();
        widgetPerf('permission:read:end', {
          widgetType: widget?.type || 'weather',
          widgetId: widget?.id || 'unknown',
          state: permissionStateBeforeRequest,
          durationMs: Math.round(performance.now() - permissionStartedAt),
        });
        widgetPerf('location:read:start', {
          widgetType: widget?.type || 'weather',
          widgetId: widget?.id || 'unknown',
        });
        const locationStartedAt = performance.now();
        let location: WeatherLocation;
        let locationSource = 'ip-location';
        const shouldTryBrowserLocation =
          forceBrowserLocation ||
          permissionStateBeforeRequest === 'granted' ||
          permissionStateBeforeRequest === 'prompt';
        try {
          location = shouldTryBrowserLocation ? await getBrowserLocation() : await fetchApproximateLocation();
          locationSource = shouldTryBrowserLocation ? 'browser-location' : 'ip-location';
        } catch (locationError) {
          if (forceBrowserLocation) {
            throw locationError;
          }

          if (shouldTryBrowserLocation) {
            console.warn('[WeatherWidget] Browser location failed, falling back to approximate location:', locationError);
            location = await fetchApproximateLocation();
            locationSource = 'ip-location-fallback';
          } else {
            throw locationError;
          }
        }
        widgetPerf('location:read:end', {
          widgetType: widget?.type || 'weather',
          widgetId: widget?.id || 'unknown',
          source: locationSource,
          durationMs: Math.round(performance.now() - locationStartedAt),
        });
        widgetPerf('network:start', {
          widgetType: widget?.type || 'weather',
          widgetId: widget?.id || 'unknown',
          source: 'open-meteo+reverse-geocode',
        });
        const networkStartedAt = performance.now();
        const nextWeather = await fetchOpenMeteoWeather(location);
        widgetPerf('network:end', {
          widgetType: widget?.type || 'weather',
          widgetId: widget?.id || 'unknown',
          source: 'open-meteo+reverse-geocode',
          durationMs: Math.round(performance.now() - networkStartedAt),
        });
        writeWeatherCache(nextWeather);
        setWeather(nextWeather);
        setStatus('ready');
      } catch (error) {
        if (!(error instanceof WeatherWidgetError && error.reason === 'permission-denied')) {
          console.warn('[WeatherWidget] Failed to load weather:', error);
        }
        if (silent && hasWeatherRef.current) {
          setStatus('ready');
          return;
        }
        const permissionWasPromptable =
          permissionStateBeforeRequest === 'prompt' || permissionStateBeforeRequest === null;
        const nextMessage =
          error instanceof WeatherWidgetError && error.reason === 'permission-denied' && permissionWasPromptable
            ? LOCATION_PROMPT_NOT_SHOWN_MESSAGE
            : error instanceof Error
              ? error.message
              : 'Weather unavailable.';
        setMessage(nextMessage);
        setStatus(
          error instanceof WeatherWidgetError && error.reason === 'permission-denied' ? 'permission-denied' : 'error',
        );
      } finally {
        isLoadingRef.current = false;
      }
    },
    [setStatus, setWeather, widget?.id, widget?.type],
  );

  useEffect(() => {
    if (firstContentLoggedRef.current || status !== 'ready' || !weather) return;
    firstContentLoggedRef.current = true;
    widgetPerf('content:firstReady', {
      widgetType: widget?.type || 'weather',
      widgetId: widget?.id || 'unknown',
      source: cachedWeather ? 'cache' : 'fresh',
    });
  }, [cachedWeather, status, weather, widget?.id, widget?.type]);

  useEffect(() => {
    if (weather) return undefined;
    if (status === 'request-location') return undefined;

    void loadWeather();
    return undefined;
  }, [loadWeather, status, weather]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadWeather(true);
    }, WEATHER_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadWeather]);

  const handleLocationClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      void loadWeather(false, true);
    },
    [loadWeather],
  );

  const stopWidgetInteraction = (event: React.SyntheticEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  if (status === 'request-location') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
        <LuLocateFixed size={26} className="text-[var(--color-iconDefault)]" />
        <div className="max-w-[220px] text-xs font-semibold text-[var(--color-textSecondary)]">
          Allow location to show local weather.
        </div>
        <button
          type="button"
          data-no-widget-drag="true"
          onPointerDown={stopWidgetInteraction}
          onMouseDown={stopWidgetInteraction}
          onTouchStart={stopWidgetInteraction}
          onClick={handleLocationClick}
          className="rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-1.5 text-xs font-semibold text-[var(--color-textPrimary)]">
          Use my location
        </button>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-[var(--color-textSecondary)]">
        <LuRefreshCw className="animate-spin" size={24} />
        <div className="text-xs font-semibold">Loading weather...</div>
      </div>
    );
  }

  const openChromeLocationSettings = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      const extensionChrome = typeof globalThis === 'undefined' ? undefined : (globalThis as any).chrome;
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const settingsUrl = origin
        ? `chrome://settings/content/siteDetails?site=${encodeURIComponent(origin)}`
        : 'chrome://settings/content/location';

      if (extensionChrome?.tabs?.create) {
        extensionChrome.tabs.create({ url: settingsUrl });
      } else {
        window.open(settingsUrl, '_blank');
      }
    } catch (err) {
      console.error('Failed to open location settings tab:', err);
    }
  };

  if (status === 'permission-denied') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-2 text-center">
        <LuLocateFixed size={24} className="text-[var(--color-textSecondary)] shrink-0 opacity-80" />
        <div className="text-xs font-bold text-[var(--color-textPrimary)]">Location Access Blocked</div>
        <div className="text-[11px] leading-tight text-[var(--color-textSecondary)] max-w-[260px]">
          Chrome is blocking location. Click below to open Site Settings, change Location to <span className="font-bold text-[var(--color-textPrimary)]">Allow</span>, then click Retry.
        </div>
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            data-no-widget-drag="true"
            onPointerDown={stopWidgetInteraction}
            onMouseDown={stopWidgetInteraction}
            onTouchStart={stopWidgetInteraction}
            onClick={openChromeLocationSettings}
            className="rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-1.5 text-xs font-semibold text-[var(--color-textPrimary)] shadow-sm transition-all hover:bg-[var(--color-hoverBg)] flex items-center gap-1.5 cursor-pointer">
            <LuExternalLink size={13} />
            Open Site Settings
          </button>
          <button
            type="button"
            data-no-widget-drag="true"
            onPointerDown={stopWidgetInteraction}
            onMouseDown={stopWidgetInteraction}
            onTouchStart={stopWidgetInteraction}
            onClick={handleLocationClick}
            className="rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-1.5 text-xs font-semibold text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] transition-all cursor-pointer">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (status === 'error' || !weather) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
        <LuCloud size={26} className="text-[var(--color-iconDefault)]" />
        <div className="text-xs font-semibold text-[var(--color-textSecondary)]">{message}</div>
        <button
          type="button"
          data-no-widget-drag="true"
          onPointerDown={stopWidgetInteraction}
          onMouseDown={stopWidgetInteraction}
          onTouchStart={stopWidgetInteraction}
          onClick={handleLocationClick}
          className="rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-1.5 text-xs font-semibold text-[var(--color-textPrimary)]">
          Retry
        </button>
      </div>
    );
  }

  const weatherStats = [
    {
      label: 'Feels like',
      value: Number.isFinite(weather.apparentTemperature) ? weather.apparentTemperature : weather.temperature,
      suffix: '\u00b0',
      icon: LuThermometerSun,
    },
    {
      label: 'Humidity',
      value: Number.isFinite(weather.humidity) ? weather.humidity : 0,
      suffix: '%',
      icon: LuDroplets,
    },
    {
      label: 'Clouds',
      value: Number.isFinite(weather.cloudCover) ? weather.cloudCover : 0,
      suffix: '%',
      icon: LuCloud,
    },
    {
      label: 'Rain',
      value: Number.isFinite(weather.precipitation) ? weather.precipitation : 0,
      suffix: ' mm',
      icon: LuCloudRain,
    },
    {
      label: 'Pressure',
      value: Number.isFinite(weather.pressure) ? weather.pressure : 0,
      suffix: ' hPa',
      icon: LuGauge,
    },
  ];

  const compactStats = [
    {
      label: 'Feels like',
      value: `${weatherStats[0].value}${weatherStats[0].suffix}`,
      icon: LuThermometerSun,
    },
    {
      label: 'Humidity',
      value: `${weatherStats[1].value}${weatherStats[1].suffix}`,
      icon: LuDroplets,
    },
    {
      label: 'Wind',
      value: `${weather.windSpeed} km/h`,
      icon: LuWind,
    },
    {
      label: 'Rain',
      value: `${weatherStats[3].value}${weatherStats[3].suffix}`,
      icon: LuCloudRain,
    },
    {
      label: 'Clouds',
      value: `${weatherStats[2].value}${weatherStats[2].suffix}`,
      icon: LuCloud,
    },
    {
      label: 'Pressure',
      value: `${weatherStats[4].value}${weatherStats[4].suffix}`,
      icon: LuGauge,
    },
  ];

  const { isNarrow, isWide, isShort, isTall, isExtraTall } = layout;

  /* NARROW (width 4) Layouts */
  if (isNarrow) {
    if (isShort) {
      /* 4 x 5 */
      return (
        <div className="relative flex h-full w-full min-w-0 flex-col overflow-hidden text-[var(--color-textPrimary)] p-3.5 gap-2.5">
          <div className="flex shrink-0 min-w-0 items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5 flex-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] text-[var(--color-textPrimary)] shadow-xs">
                <WeatherIcon code={weather.weatherCode} size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-baseline gap-1.5">
                  <span className="shrink-0 text-2xl font-bold leading-none">{weather.temperature}&deg;</span>
                  <span className="truncate text-[11px] font-semibold text-[var(--color-textSecondary)]">
                    {getWeatherDescription(weather.weatherCode)}
                  </span>
                </div>
                <div className="mt-1 flex min-w-0 items-center gap-1 text-[9px] font-semibold leading-none text-[var(--color-textMuted)]">
                  <LuMapPin size={9} className="shrink-0 text-[var(--color-iconDefault)]" />
                  <span className="min-w-0 truncate" title={weather.placeLabel}>{weather.placeLabel}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              data-no-widget-drag="true"
              aria-label="Refresh weather"
              title="Refresh weather"
              onPointerDown={stopWidgetInteraction}
              onMouseDown={stopWidgetInteraction}
              onTouchStart={stopWidgetInteraction}
              onClick={handleLocationClick}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] dark:bg-[var(--color-widgetInnerBg)] text-[var(--color-textSecondary)] transition hover:text-[var(--color-textPrimary)] cursor-pointer">
              <LuRefreshCw size={12} />
            </button>
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-3 gap-2">
            {compactStats.map(stat => {
              const IconComponent = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="flex min-w-0 flex-col justify-center rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] dark:bg-[var(--color-widgetInnerBg)] px-2.5 py-2">
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-[var(--color-textSecondary)] min-w-0">
                    <IconComponent size={11} className="shrink-0 text-[var(--color-iconDefault)]" />
                    <span className="truncate">{stat.label}</span>
                  </div>
                  <div className="mt-1 truncate text-xs font-bold text-[var(--color-textPrimary)]">
                    {stat.value}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    /* 4 x 10 & 4 x 15 (Narrow Tall / Extra Tall) */
    return (
      <div className="relative flex h-full w-full min-w-0 flex-col justify-between overflow-hidden text-[var(--color-textPrimary)] p-4 gap-3">
        {/* Header Zone */}
        <div className="flex shrink-0 min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1 text-xs font-bold text-[var(--color-textPrimary)]" title={weather.placeLabel}>
            <LuMapPin size={12} className="shrink-0 text-[var(--color-iconDefault)]" />
            <span className="truncate">{weather.placeLabel}</span>
          </div>
          <button
            type="button"
            data-no-widget-drag="true"
            aria-label="Refresh weather"
            title="Refresh weather"
            onPointerDown={stopWidgetInteraction}
            onMouseDown={stopWidgetInteraction}
            onTouchStart={stopWidgetInteraction}
            onClick={handleLocationClick}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] dark:bg-[var(--color-widgetInnerBg)] text-[var(--color-textSecondary)] transition hover:text-[var(--color-textPrimary)] cursor-pointer">
            <LuRefreshCw size={12} />
          </button>
        </div>

        {/* Flexible Middle Summary Zone */}
        <div className="flex-1 flex flex-col items-center justify-center gap-2 my-auto">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] dark:bg-[var(--color-widgetInnerBg)] text-[var(--color-textPrimary)] shadow-sm">
            <WeatherIcon code={weather.weatherCode} size={32} />
          </div>
          <div className="text-center">
            <div className="text-4xl font-extrabold leading-none text-[var(--color-textPrimary)]">
              {weather.temperature}&deg;
            </div>
            <div className="mt-1 text-xs font-bold text-[var(--color-textSecondary)]">
              {getWeatherDescription(weather.weatherCode)}
            </div>
          </div>
        </div>

        {/* Bottom Metrics 2x3 Grid */}
        <div className="shrink-0 grid grid-cols-2 gap-2">
          {compactStats.map(stat => {
            const IconComponent = stat.icon;
            return (
              <div
                key={stat.label}
                className="flex min-w-0 flex-col justify-center rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] dark:bg-[var(--color-widgetInnerBg)] p-2.5">
                <div className="flex items-center gap-1 text-[10px] font-semibold text-[var(--color-textSecondary)] min-w-0">
                  <IconComponent size={11} className="shrink-0 text-[var(--color-iconDefault)]" />
                  <span className="truncate">{stat.label}</span>
                </div>
                <div className="mt-0.5 truncate text-xs font-bold text-[var(--color-textPrimary)]">
                  {stat.value}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* WIDE (width 12) Layouts */
  if (isWide) {
    if (isShort) {
      /* 12 x 5 */
      return (
        <div className="relative flex h-full w-full flex-col justify-center gap-3.5 overflow-hidden p-5">
          <div className="flex min-w-0 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <LuMapPin size={15} className="shrink-0 text-[var(--color-iconDefault)]" />
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-[var(--color-textPrimary)]">{weather.placeLabel}</div>
                <div className="text-[10px] font-semibold text-[var(--color-textMuted)]">
                  Updated {weather.updatedAtLabel || 'Now'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] dark:bg-[var(--color-widgetInnerBg)] text-[var(--color-textPrimary)]">
                  <WeatherIcon code={weather.weatherCode} size={20} />
                </div>
                <span className="text-2xl font-bold text-[var(--color-textPrimary)]">{weather.temperature}&deg;</span>
                <span className="text-xs font-bold text-[var(--color-textSecondary)] max-w-[120px] truncate">{getWeatherDescription(weather.weatherCode)}</span>
              </div>
              <button
                type="button"
                data-no-widget-drag="true"
                aria-label="Refresh weather"
                title="Refresh weather"
                onPointerDown={stopWidgetInteraction}
                onMouseDown={stopWidgetInteraction}
                onTouchStart={stopWidgetInteraction}
                onClick={handleLocationClick}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] dark:bg-[var(--color-widgetInnerBg)] text-[var(--color-textSecondary)] transition hover:text-[var(--color-textPrimary)] cursor-pointer">
                <LuRefreshCw size={14} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {weatherStats.map(stat => {
              const IconComponent = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="min-w-0 rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] dark:bg-[var(--color-widgetInnerBg)] px-2.5 py-2">
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-normal text-[var(--color-textMuted)]">
                    <IconComponent size={12} className="shrink-0" />
                    <span className="truncate">{stat.label}</span>
                  </div>
                  <div className="truncate text-sm font-bold text-[var(--color-textPrimary)]">
                    {stat.value}
                    {stat.suffix}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    /* 12 x 10 & 12 x 15 (Wide Tall / Extra Tall) */
    return (
      <div className="relative flex h-full w-full flex-col justify-between overflow-hidden p-6 gap-4">
        {/* Header Bar */}
        <div className="flex min-w-0 items-center justify-between gap-4 max-w-[680px] w-full mx-auto">
          <div className="flex min-w-0 items-center gap-2 text-xs font-bold text-[var(--color-textPrimary)]" title={weather.placeLabel}>
            <LuMapPin size={14} className="shrink-0 text-[var(--color-iconDefault)]" />
            <span className="truncate">{weather.placeLabel}</span>
            <span className="text-[10px] font-normal text-[var(--color-textMuted)] ml-2">Updated {weather.updatedAtLabel || 'Now'}</span>
          </div>

          <button
            type="button"
            data-no-widget-drag="true"
            aria-label="Refresh weather"
            title="Refresh weather"
            onPointerDown={stopWidgetInteraction}
            onMouseDown={stopWidgetInteraction}
            onTouchStart={stopWidgetInteraction}
            onClick={handleLocationClick}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] dark:bg-[var(--color-widgetInnerBg)] text-[var(--color-textSecondary)] transition hover:text-[var(--color-textPrimary)] cursor-pointer">
            <LuRefreshCw size={14} />
          </button>
        </div>

        {/* Centered Primary Weather Summary */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 my-auto max-w-[680px] w-full mx-auto">
          <div className="flex items-center gap-6 rounded-2xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] dark:bg-[var(--color-widgetInnerBg)] px-8 py-5 shadow-xs">
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]">
              <WeatherIcon code={weather.weatherCode} size={36} />
            </div>
            <div>
              <div className="text-5xl font-extrabold text-[var(--color-textPrimary)] leading-none">{weather.temperature}&deg;</div>
              <div className="mt-1.5 text-sm font-bold text-[var(--color-textSecondary)]">{getWeatherDescription(weather.weatherCode)}</div>
            </div>
          </div>
        </div>

        {/* 5 Metrics Grid */}
        <div className="shrink-0 grid grid-cols-5 gap-3 max-w-[680px] w-full mx-auto">
          {weatherStats.map(stat => {
            const IconComponent = stat.icon;
            return (
              <div
                key={stat.label}
                className="min-w-0 rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] dark:bg-[var(--color-widgetInnerBg)] px-3 py-2.5">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-normal text-[var(--color-textMuted)]">
                  <IconComponent size={12} className="shrink-0" />
                  <span className="truncate">{stat.label}</span>
                </div>
                <div className="truncate text-sm font-bold text-[var(--color-textPrimary)]">
                  {stat.value}
                  {stat.suffix}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* MEDIUM (width 8) Layouts */
  if (isTall || isExtraTall) {
    /* 8 x 10 & 8 x 15 */
    return (
      <div className="relative flex h-full w-full min-w-0 flex-col justify-between overflow-hidden p-5 gap-3">
        {/* Header */}
        <div className="flex shrink-0 min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-[var(--color-textPrimary)]" title={weather.placeLabel}>
            <LuMapPin size={12} className="shrink-0 text-[var(--color-iconDefault)]" />
            <span className="truncate">{weather.placeLabel}</span>
            <span className="text-[10px] font-normal text-[var(--color-textMuted)] ml-1">({weather.updatedAtLabel || 'Now'})</span>
          </div>
          <button
            type="button"
            data-no-widget-drag="true"
            aria-label="Refresh weather"
            title="Refresh weather"
            onPointerDown={stopWidgetInteraction}
            onMouseDown={stopWidgetInteraction}
            onTouchStart={stopWidgetInteraction}
            onClick={handleLocationClick}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] dark:bg-[var(--color-widgetInnerBg)] text-[var(--color-textSecondary)] transition hover:text-[var(--color-textPrimary)] cursor-pointer">
            <LuRefreshCw size={12} />
          </button>
        </div>

        {/* Primary Summary Center */}
        <div className="flex-1 flex flex-col items-center justify-center gap-2 my-auto">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] dark:bg-[var(--color-widgetInnerBg)] text-[var(--color-textPrimary)] shadow-xs">
            <WeatherIcon code={weather.weatherCode} size={30} />
          </div>
          <div className="text-center">
            <div className="text-4xl font-extrabold leading-none text-[var(--color-textPrimary)]">
              {weather.temperature}&deg;
            </div>
            <div className="mt-1 text-xs font-bold text-[var(--color-textSecondary)]">
              {getWeatherDescription(weather.weatherCode)}
            </div>
          </div>
        </div>

        {/* 3x2 Metrics Grid */}
        <div className="shrink-0 grid grid-cols-3 gap-2">
          {compactStats.map(stat => {
            const IconComponent = stat.icon;
            return (
              <div
                key={stat.label}
                className="flex min-w-0 flex-col justify-center rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] dark:bg-[var(--color-widgetInnerBg)] p-2">
                <div className="flex items-center gap-1 text-[10px] font-semibold text-[var(--color-textSecondary)] min-w-0">
                  <IconComponent size={11} className="shrink-0 text-[var(--color-iconDefault)]" />
                  <span className="truncate">{stat.label}</span>
                </div>
                <div className="mt-0.5 truncate text-xs font-bold text-[var(--color-textPrimary)]">
                  {stat.value}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* 8 x 5 (Medium Short) */
  return (
    <div className="relative flex h-full w-full min-w-0 flex-col justify-center gap-3.5 overflow-hidden text-[var(--color-textPrimary)] px-5 py-4">
      <div className="flex shrink-0 min-w-0 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] dark:bg-[var(--color-widgetInnerBg)] text-[var(--color-textPrimary)] shadow-xs">
            <WeatherIcon code={weather.weatherCode} size={24} />
          </div>
          <div className="flex min-w-0 items-baseline gap-2.5">
            <div className="shrink-0 text-3xl font-bold leading-none text-[var(--color-textPrimary)]">
              {weather.temperature}&deg;
            </div>
            <div className="truncate text-sm font-bold text-[var(--color-textSecondary)]">
              {getWeatherDescription(weather.weatherCode)}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2 text-right">
          <div className="flex min-w-0 flex-col items-end text-[10px] font-semibold text-[var(--color-textSecondary)]">
            <div className="flex items-center gap-1 min-w-0" title={weather.placeLabel}>
              <LuMapPin size={10} className="shrink-0 text-[var(--color-iconDefault)]" />
              <span className="truncate max-w-[180px]">{weather.placeLabel}</span>
            </div>
            <div className="text-[9px] text-[var(--color-textMuted)] mt-0.5">
              {weather.updatedAtLabel || 'Now'}
            </div>
          </div>

          <button
            type="button"
            data-no-widget-drag="true"
            aria-label="Refresh weather"
            title="Refresh weather"
            onPointerDown={stopWidgetInteraction}
            onMouseDown={stopWidgetInteraction}
            onTouchStart={stopWidgetInteraction}
            onClick={handleLocationClick}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] dark:bg-[var(--color-widgetInnerBg)] text-[var(--color-textSecondary)] transition hover:text-[var(--color-textPrimary)] cursor-pointer">
            <LuRefreshCw size={13} />
          </button>
        </div>
      </div>

      <div className="grid shrink-0 min-w-0 grid-cols-6 gap-2">
        {compactStats.map(stat => {
          const IconComponent = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex min-w-0 flex-col justify-center rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] dark:bg-[var(--color-widgetInnerBg)] px-2 py-2">
              <div className="flex min-w-0 items-center gap-1 text-[9px] font-semibold text-[var(--color-textSecondary)]">
                <IconComponent size={10} className="shrink-0 text-[var(--color-iconDefault)]" />
                <span className="truncate">{stat.label}</span>
              </div>
              <div className="mt-0.5 truncate text-xs font-bold text-[var(--color-textPrimary)]">
                {stat.value}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeatherWidget;
