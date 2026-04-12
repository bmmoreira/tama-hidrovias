'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/lib/use-app-translation';
import {
  CalendarDays,
  Droplets,
  MapPin,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';

export interface StationPopupData {
  name: string;
  satellite?: string;
  river?: string;
  basin?: string;
  startDate?: string;
  endDate?: string;
  value?: number;
  change?: number;
  anomaly?: number;
  longitude?: number;
  latitude?: number;
}

interface StationPopupProps {
  data: StationPopupData;
  onClose?: () => void;
  onViewDetails?: (data: StationPopupData) => void;
  onToggleFavorite?: (data: StationPopupData) => void;
  isFavorite?: boolean;
}

function formatNumber(value: number, digits = 2) {
  return Number(value).toFixed(digits);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

function renderBadge(text: string, variant: 'outline' | 'secondary' | 'destructive' = 'outline') {
  const variantClassName =
    variant === 'destructive'
      ? 'border-transparent bg-red-600 text-white dark:bg-red-500/80'
      : variant === 'secondary'
        ? 'border-transparent bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
        : 'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200';

  return (
    <span
      className={`inline-flex w-fit items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium ${variantClassName}`}
    >
      {text}
    </span>
  );
}

export default function StationPopup({
  data,
  onClose,
  onViewDetails,
  onToggleFavorite,
  isFavorite = false,
}: StationPopupProps) {
  const { t } = useTranslation();
  const hasCoordinates =
    typeof data.latitude === 'number' && Number.isFinite(data.latitude) &&
    typeof data.longitude === 'number' && Number.isFinite(data.longitude);
  const hasHydrologicalData =
    data.value !== undefined || data.change !== undefined || data.anomaly !== undefined;
  const canViewDetails = typeof onViewDetails === 'function';
  const canToggleFavorite = typeof onToggleFavorite === 'function';

  return (
    <Card className="w-full max-w-sm border border-gray-200/80 bg-white/95 shadow-2xl backdrop-blur-md dark:border-gray-700/60 dark:bg-gray-900/95">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <CardTitle className="truncate text-base font-semibold text-blue-600 dark:text-blue-400">
              {data.name}
            </CardTitle>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              {data.river || data.basin ? (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 flex-shrink-0 text-gray-500" />
                  <span className="truncate">
                    {data.river || t('mapPopup.unknownRiver')}
                    {data.basin ? ` • ${data.basin}` : ''}
                  </span>
                </div>
              ) : null}
              {data.satellite ? renderBadge(data.satellite) : null}
            </div>
          </div>
          {onClose ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label={t('mapPopup.close')}
              className="h-8 w-8 rounded-full p-0"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        {hasCoordinates ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('mapPopup.latitude')}</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {formatNumber(data.latitude!, 4)}°
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('mapPopup.longitude')}</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {formatNumber(data.longitude!, 4)}°
              </p>
            </div>
          </div>
        ) : null}

        {hasHydrologicalData ? (
          <div className="grid gap-3">
            {data.value !== undefined ? (
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Droplets className="h-4 w-4 flex-shrink-0 text-blue-500" />
                <span className="font-medium">{t('mapPopup.level')}:</span>
                <span>{formatNumber(data.value)} m</span>
              </div>
            ) : null}

            {data.change !== undefined ? (
              <div className="flex items-center gap-2">
                {data.change >= 0 ? (
                  <TrendingUp className="h-4 w-4 flex-shrink-0 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 flex-shrink-0 text-red-500" />
                )}
                <span className="font-medium text-gray-700 dark:text-gray-300">{t('mapPopup.change')}:</span>
                <span
                  className={
                    data.change >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }
                >
                  {data.change >= 0 ? '+' : ''}
                  {formatNumber(data.change)} m
                </span>
              </div>
            ) : null}

            {data.anomaly !== undefined ? (
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-700 dark:text-gray-300">{t('mapPopup.anomaly')}:</span>
                {renderBadge(
                  `${data.anomaly >= 0 ? '+' : ''}${formatNumber(data.anomaly, 1)}`,
                  Math.abs(data.anomaly) > 1 ? 'destructive' : 'secondary',
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {data.startDate || data.endDate ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <CalendarDays className="h-4 w-4 flex-shrink-0 text-gray-500" />
              <span className="font-medium">{t('mapPopup.monitoringPeriod')}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pl-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('mapPopup.start')}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {data.startDate ? formatDate(data.startDate) : '...'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('mapPopup.end')}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {data.endDate ? formatDate(data.endDate) : '...'}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          <Button
            size="sm"
            className="w-full sm:flex-1"
            disabled={!canViewDetails}
            onClick={() => onViewDetails?.(data)}
            title={canViewDetails ? t('mapPopup.viewDetails') : t('mapPopup.viewDetailsFuture')}
          >
            {t('mapPopup.viewDetails')}
          </Button>
          <Button
            size="sm"
            variant={isFavorite ? 'default' : 'outline'}
            className="w-full sm:w-auto"
            disabled={!canToggleFavorite}
            onClick={() => onToggleFavorite?.(data)}
            title={canToggleFavorite ? t('mapPopup.toggleFavorite') : t('mapPopup.favoriteFuture')}
          >
            {isFavorite ? t('mapPopup.favorited') : t('mapPopup.addFavorite')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={onClose}
            disabled={!onClose}
          >
            {t('mapPopup.close')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}