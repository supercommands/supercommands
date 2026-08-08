import { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'react-icons/lu';
import type { WidgetSizePreset } from '../widgetDashboard.types';

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
    if (typeof sessionStorage === 'undefined') return null;
    LEGACY_WEATHER_CACHE_KEYS.forEach(cacheKey => sessionStorage.removeItem(cacheKey));
    const rawCache = sessionStorage.getItem(WEATHER_CACHE_KEY);
    if (!rawCache) return null;

    const parsedCache = JSON.parse(rawCache) as WeatherCachePayload;
    if (!isValidWeatherData(parsedCache?.weather) || Date.now() - parsedCache.cachedAt > WEATHER_REFRESH_INTERVAL_MS) {
      sessionStorage.removeItem(WEATHER_CACHE_KEY);
      return null;
    }

    return parsedCache.weather;
  } catch {
    sessionStorage.removeItem(WEATHER_CACHE_KEY);
    return null;
  }
};

const writeWeatherCache = (weather: WeatherData) => {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(
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
        maximumAge: 10 * 60 * 1000,
        timeout: 30000,
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

  const fallbackPlaceLabel = formatTimezonePlaceLabel(data.timezone) || location.label;
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

interface WeatherWidgetProps {
  sizePreset?: WidgetSizePreset;
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ sizePreset = 'medium' }) => {
  const isLoadingRef = useRef(false);
  const [weatherState, setWeatherState] = useState<{
    weather: WeatherData | null;
    status: WeatherStatus;
  }>(() => {
    const cachedWeather = readWeatherCache();
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
    async (silent = false) => {
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;
      if (!silent || !hasWeatherRef.current) setStatus('loading');
      setMessage('Weather unavailable.');
      let permissionStateBeforeRequest: PermissionState | null = null;

      try {
        permissionStateBeforeRequest = await getLocationPermissionState();
        if (permissionStateBeforeRequest === 'denied') {
          setMessage(LOCATION_BLOCKED_MESSAGE);
          setStatus('permission-denied');
          return;
        }

        const location = await getBrowserLocation();
        const nextWeather = await fetchOpenMeteoWeather(location);
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
    [setStatus, setWeather],
  );

  useEffect(() => {
    let cancelled = false;

    if (weather) return undefined;

    getLocationPermissionState().then(permissionState => {
      if (cancelled) return;

      if (permissionState === 'granted') {
        void loadWeather();
        return;
      }

      if (permissionState === 'denied') {
        setMessage(LOCATION_BLOCKED_MESSAGE);
        setStatus('permission-denied');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadWeather, setStatus, weather]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void getLocationPermissionState().then(permissionState => {
        if (permissionState === 'granted') void loadWeather(true);
      });
    }, WEATHER_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadWeather]);

  const handleLocationClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      void loadWeather();
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

  if (status === 'permission-denied') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
        <LuLocateFixed size={26} className="text-[var(--color-iconDefault)]" />
        <div className="max-w-[220px] text-xs font-semibold text-[var(--color-textSecondary)]">{message}</div>
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
  const isSmall = sizePreset === 'small';
  const isLarge = sizePreset === 'large';
  const compactStats = [
    { label: 'Wind', value: `${weather.windSpeed} km/h` },
    {
      label: 'Gust',
      value: `${Number.isFinite(weather.windGusts) ? weather.windGusts : weather.windSpeed} km/h`,
    },
    { label: 'Feels like', value: `${weatherStats[0].value}${weatherStats[0].suffix}` },
    { label: 'Humidity', value: `${weatherStats[1].value}${weatherStats[1].suffix}` },
    { label: 'Clouds', value: `${weatherStats[2].value}${weatherStats[2].suffix}` },
    { label: 'Rain', value: `${weatherStats[3].value}${weatherStats[3].suffix}` },
    { label: 'Pressure', value: `${weatherStats[4].value}${weatherStats[4].suffix}`, wide: true },
  ];

  if (isSmall) {
    return (
      <div className="relative flex h-full w-full min-w-0 flex-col gap-2 overflow-hidden text-[var(--color-textPrimary)]">
        <div className="absolute right-0 top-0">
          <button
            type="button"
            data-no-widget-drag="true"
            aria-label="Refresh weather"
            title="Refresh weather"
            onPointerDown={stopWidgetInteraction}
            onMouseDown={stopWidgetInteraction}
            onTouchStart={stopWidgetInteraction}
            onClick={handleLocationClick}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] text-[var(--color-textSecondary)] transition hover:text-[var(--color-textPrimary)]">
            <LuRefreshCw size={13} />
          </button>
        </div>

        <div className="flex min-w-0 items-center gap-2.5 pr-8">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)]">
            <WeatherIcon code={weather.weatherCode} size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 text-3xl font-bold leading-none">{weather.temperature}&deg;</span>
              <span className="truncate text-[11px] font-bold text-[var(--color-textSecondary)]">
                {getWeatherDescription(weather.weatherCode)}
              </span>
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-1 text-[9px] font-semibold leading-none text-[var(--color-textMuted)]">
              <LuMapPin size={10} className="shrink-0" />
              <span className="min-w-0 truncate">{weather.placeLabel}</span>
              <span className="shrink-0">&middot; {weather.updatedAtLabel || 'Now'}</span>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-2 gap-x-2 gap-y-1 text-[10px] leading-none">
          {compactStats.map(stat => (
            <div
              key={stat.label}
              className={`flex min-w-0 flex-col justify-center px-1 py-1 ${stat.wide ? 'col-span-2' : ''}`}>
              <div className="whitespace-normal text-[8px] font-bold leading-[1.15] text-[var(--color-textMuted)]">
                {stat.label}
              </div>
              <div className="mt-1 whitespace-nowrap text-[10px] font-bold text-[var(--color-textPrimary)]">
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isLarge) {
    return (
      <div className="relative flex h-full w-full flex-col justify-center gap-3 overflow-hidden">
        <div className="absolute right-0 top-0 z-10">
          <button
            type="button"
            data-no-widget-drag="true"
            aria-label="Refresh weather"
            title="Refresh weather"
            onPointerDown={stopWidgetInteraction}
            onMouseDown={stopWidgetInteraction}
            onTouchStart={stopWidgetInteraction}
            onClick={handleLocationClick}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] text-[var(--color-textSecondary)] transition hover:text-[var(--color-textPrimary)]">
            <LuRefreshCw size={16} />
          </button>
        </div>

        <div className="flex min-w-0 items-start gap-2 pr-10 text-[var(--color-textSecondary)]">
          <LuMapPin size={15} className="mt-0.5 shrink-0 text-[var(--color-iconDefault)]" />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-[var(--color-textPrimary)]">{weather.placeLabel}</div>
            <div className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-textMuted)]">
              Updated {weather.updatedAtLabel || 'Now'}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] text-[var(--color-textPrimary)]">
              <WeatherIcon code={weather.weatherCode} size={30} />
            </div>
            <div className="min-w-0">
              <div className="text-5xl font-bold leading-none text-[var(--color-textPrimary)]">
                {weather.temperature}&deg;
              </div>
              <div className="mt-1 truncate text-base font-bold text-[var(--color-textSecondary)]">
                {getWeatherDescription(weather.weatherCode)}
              </div>
            </div>
          </div>

          <div className="flex min-w-[96px] flex-col gap-1 rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-2 text-right">
            <div className="flex items-center justify-end gap-1 text-xs font-bold text-[var(--color-textPrimary)]">
              <LuWind size={13} />
              {weather.windSpeed} km/h
            </div>
            <div className="text-[10px] font-semibold text-[var(--color-textMuted)]">
              Gust {Number.isFinite(weather.windGusts) ? weather.windGusts : weather.windSpeed} km/h
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {weatherStats.map(stat => {
            const IconComponent = stat.icon;
            return (
              <div
                key={stat.label}
                className="min-w-0 rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-2.5 py-2">
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

  return (
    <div className="relative flex h-full w-full min-w-0 flex-col gap-3 overflow-hidden">
      <div className="absolute right-0 top-0 z-10">
        <button
          type="button"
          data-no-widget-drag="true"
          aria-label="Refresh weather"
          title="Refresh weather"
          onPointerDown={stopWidgetInteraction}
          onMouseDown={stopWidgetInteraction}
          onTouchStart={stopWidgetInteraction}
          onClick={handleLocationClick}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] text-[var(--color-textSecondary)] transition hover:text-[var(--color-textPrimary)]">
          <LuRefreshCw size={16} />
        </button>
      </div>

      <div className="flex min-h-0 flex-[1.15] flex-col justify-center gap-2.5 pr-11">
        <div className="flex min-w-0 items-center justify-between gap-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] text-[var(--color-textPrimary)]">
              <WeatherIcon code={weather.weatherCode} size={28} />
            </div>
            <div className="flex min-w-0 items-end gap-3">
              <div className="shrink-0 text-5xl font-bold leading-none text-[var(--color-textPrimary)]">
                {weather.temperature}&deg;
              </div>
              <div className="truncate pb-1 text-base font-bold text-[var(--color-textSecondary)]">
                {getWeatherDescription(weather.weatherCode)}
              </div>
            </div>
          </div>

          <div className="grid w-[34%] min-w-[180px] shrink-0 grid-cols-2 gap-5 pl-4">
            <div className="min-w-0 py-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-textMuted)]">
                <LuWind size={13} className="shrink-0" />
                <span>Wind</span>
              </div>
              <div className="mt-1 truncate text-sm font-bold text-[var(--color-textPrimary)]">
                {weather.windSpeed} km/h
              </div>
            </div>
            <div className="min-w-0 py-2">
              <div className="text-[10px] font-bold text-[var(--color-textMuted)]">Gust</div>
              <div className="mt-1 truncate text-sm font-bold text-[var(--color-textPrimary)]">
                {Number.isFinite(weather.windGusts) ? weather.windGusts : weather.windSpeed} km/h
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-[var(--color-textMuted)]">
          <LuMapPin size={12} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate" title={weather.placeLabel}>
            {weather.placeLabel}
          </span>
          <span className="shrink-0">&middot; {weather.updatedAtLabel || 'Now'}</span>
        </div>
      </div>

      <div className="grid min-h-[62px] flex-1 grid-cols-5 gap-4">
        {weatherStats.map(stat => {
          const IconComponent = stat.icon;
          return (
            <div key={stat.label} className="flex min-w-0 flex-col justify-center px-1 py-2">
              <div className="flex min-w-0 items-start gap-1 text-[9px] font-bold leading-tight text-[var(--color-textMuted)]">
                <IconComponent size={11} className="mt-px shrink-0" />
                <span className="whitespace-normal">{stat.label}</span>
              </div>
              <div className="mt-1.5 whitespace-nowrap text-[13px] font-bold text-[var(--color-textPrimary)]">
                {stat.value}
                {stat.suffix}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeatherWidget;
