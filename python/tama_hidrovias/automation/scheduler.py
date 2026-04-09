"""APScheduler-based scheduler wrapper for pipeline orchestration."""

from __future__ import annotations

import logging
from typing import Any, Callable

logger = logging.getLogger(__name__)


class PipelineScheduler:
    """Wrap APScheduler's ``BlockingScheduler`` with convenience methods.

    Parameters
    ----------
    config:
        Optional configuration dictionary (reserved for future use, e.g.
        timezone, job store settings).
    """

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        from apscheduler.schedulers.blocking import BlockingScheduler

        self.config = config or {}
        timezone = self.config.get("timezone", "America/Sao_Paulo")
        self._scheduler = BlockingScheduler(timezone=timezone)
        logger.info("PipelineScheduler initialised (timezone=%s)", timezone)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def add_daily_job(
        self,
        func: Callable,
        hour: int = 0,
        minute: int = 0,
        job_id: str | None = None,
        **kwargs: Any,
    ) -> None:
        """Schedule *func* to run once every day at *hour*:*minute*.

        Parameters
        ----------
        func:
            Callable to schedule.
        hour:
            Hour of day (0–23, UTC or scheduler timezone).
        minute:
            Minute of hour (0–59).
        job_id:
            Optional unique identifier for the job.
        **kwargs:
            Additional keyword arguments forwarded to *func*.
        """
        jid = job_id or f"{func.__name__}_daily"
        self._scheduler.add_job(
            func,
            trigger="cron",
            hour=hour,
            minute=minute,
            id=jid,
            kwargs=kwargs,
            replace_existing=True,
        )
        logger.info("Daily job registered: %s at %02d:%02d", jid, hour, minute)

    def add_weekly_job(
        self,
        func: Callable,
        day_of_week: str | int = "mon",
        hour: int = 0,
        job_id: str | None = None,
        **kwargs: Any,
    ) -> None:
        """Schedule *func* to run once every week.

        Parameters
        ----------
        func:
            Callable to schedule.
        day_of_week:
            Day name (e.g. ``"mon"``, ``"fri"``) or ISO weekday integer (0=Mon).
        hour:
            Hour of day (0–23).
        job_id:
            Optional unique identifier for the job.
        **kwargs:
            Additional keyword arguments forwarded to *func*.
        """
        jid = job_id or f"{func.__name__}_weekly"
        self._scheduler.add_job(
            func,
            trigger="cron",
            day_of_week=day_of_week,
            hour=hour,
            id=jid,
            kwargs=kwargs,
            replace_existing=True,
        )
        logger.info(
            "Weekly job registered: %s on %s at %02d:00", jid, day_of_week, hour
        )

    def start(self) -> None:
        """Start the blocking scheduler.

        This call blocks the current thread until :meth:`stop` is called or a
        ``KeyboardInterrupt`` is received.
        """
        logger.info("Starting PipelineScheduler …")
        try:
            self._scheduler.start()
        except (KeyboardInterrupt, SystemExit):
            logger.info("Scheduler interrupted by signal.")

    def stop(self) -> None:
        """Shut down the scheduler gracefully."""
        if self._scheduler.running:
            self._scheduler.shutdown(wait=False)
            logger.info("PipelineScheduler stopped.")
        else:
            logger.debug("PipelineScheduler was not running.")
