"""EyeGuardian – SQLite persistence layer

Tables
------
sessions           – one row per monitoring session (camera open → close)
snapshots          – periodic metric captures (default: every 30 s)
alerts             – notable events (dry eyes, bad posture, high strain …)
daily_summaries    – pre-aggregated daily stats for fast charting
weekly_summaries   – pre-aggregated weekly stats  (ISO week: Mon-Sun)
monthly_summaries  – pre-aggregated monthly stats (YYYY-MM)
"""

import sqlite3
import os
import time
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any

DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DB_PATH = os.path.join(DB_DIR, "eyeguardian.db")

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------
_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at      TEXT    NOT NULL,          -- ISO-8601
    ended_at        TEXT,                      -- ISO-8601, NULL while active
    duration_seconds INTEGER                   -- filled on session end
);

CREATE TABLE IF NOT EXISTS snapshots (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id       INTEGER NOT NULL REFERENCES sessions(id),
    timestamp        TEXT    NOT NULL,         -- ISO-8601

    -- eye / blink
    blink_rate       INTEGER,
    ear              REAL,
    total_blinks     INTEGER,
    incomplete_blinks INTEGER,
    is_dry           INTEGER,                  -- 0/1

    -- distance
    distance_cm      REAL,
    distance_risk    REAL,

    -- lighting
    brightness       REAL,
    light_level      TEXT,
    light_risk       INTEGER,

    -- posture
    head_position    TEXT,
    posture_overall  TEXT,
    pitch            REAL,
    yaw              REAL,
    roll             REAL,
    posture_risk     REAL,
    posture_score    INTEGER,

    -- redness
    redness          REAL,
    redness_level    TEXT,

    -- overall
    strain_index     INTEGER,
    risk_score       REAL,
    risk_level       TEXT
);

CREATE TABLE IF NOT EXISTS alerts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id   INTEGER NOT NULL REFERENCES sessions(id),
    timestamp    TEXT    NOT NULL,
    alert_type   TEXT    NOT NULL,              -- e.g. high_strain, dry_eyes …
    severity     TEXT    NOT NULL,              -- warning | danger
    message      TEXT
);

CREATE TABLE IF NOT EXISTS daily_summaries (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    date                  TEXT    NOT NULL UNIQUE,   -- YYYY-MM-DD
    total_session_minutes REAL    DEFAULT 0,
    avg_blink_rate        REAL    DEFAULT 0,
    avg_distance_cm       REAL    DEFAULT 0,
    avg_posture_score     REAL    DEFAULT 0,
    avg_brightness        REAL    DEFAULT 0,
    avg_strain_index      REAL    DEFAULT 0,
    avg_redness           REAL    DEFAULT 0,
    alert_count           INTEGER DEFAULT 0,
    dry_eye_minutes       REAL    DEFAULT 0,
    bad_posture_minutes   REAL    DEFAULT 0
);

CREATE TABLE IF NOT EXISTS weekly_summaries (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    year                  INTEGER NOT NULL,
    week                  INTEGER NOT NULL,          -- ISO week number (1-53)
    week_start            TEXT    NOT NULL,           -- Monday YYYY-MM-DD
    week_end              TEXT    NOT NULL,           -- Sunday YYYY-MM-DD
    total_session_minutes REAL    DEFAULT 0,
    avg_blink_rate        REAL    DEFAULT 0,
    avg_distance_cm       REAL    DEFAULT 0,
    avg_posture_score     REAL    DEFAULT 0,
    avg_brightness        REAL    DEFAULT 0,
    avg_strain_index      REAL    DEFAULT 0,
    avg_redness           REAL    DEFAULT 0,
    alert_count           INTEGER DEFAULT 0,
    dry_eye_minutes       REAL    DEFAULT 0,
    bad_posture_minutes   REAL    DEFAULT 0,
    days_active           INTEGER DEFAULT 0,
    UNIQUE(year, week)
);

CREATE TABLE IF NOT EXISTS monthly_summaries (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    year                  INTEGER NOT NULL,
    month                 INTEGER NOT NULL,           -- 1-12
    total_session_minutes REAL    DEFAULT 0,
    avg_blink_rate        REAL    DEFAULT 0,
    avg_distance_cm       REAL    DEFAULT 0,
    avg_posture_score     REAL    DEFAULT 0,
    avg_brightness        REAL    DEFAULT 0,
    avg_strain_index      REAL    DEFAULT 0,
    avg_redness           REAL    DEFAULT 0,
    alert_count           INTEGER DEFAULT 0,
    dry_eye_minutes       REAL    DEFAULT 0,
    bad_posture_minutes   REAL    DEFAULT 0,
    days_active           INTEGER DEFAULT 0,
    UNIQUE(year, month)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_session  ON snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_ts       ON snapshots(timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_session     ON alerts(session_id);
CREATE INDEX IF NOT EXISTS idx_daily_date         ON daily_summaries(date);
CREATE INDEX IF NOT EXISTS idx_weekly_yw          ON weekly_summaries(year, week);
CREATE INDEX IF NOT EXISTS idx_monthly_ym         ON monthly_summaries(year, month);
"""


# ---------------------------------------------------------------------------
# Database helper
# ---------------------------------------------------------------------------
class EyeGuardianDB:
    """Thin wrapper around SQLite for EyeGuardian data storage."""

    def __init__(self, db_path: str = DB_PATH):
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.db_path = db_path
        self._conn: Optional[sqlite3.Connection] = None
        self._ensure_schema()

    # -- connection management -----------------------------------------------

    def _get_conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.execute("PRAGMA foreign_keys=ON")
        return self._conn

    def _ensure_schema(self):
        conn = self._get_conn()
        conn.executescript(_SCHEMA_SQL)
        conn.commit()

    def close(self):
        if self._conn:
            self._conn.close()
            self._conn = None

    # -- sessions ------------------------------------------------------------

    def start_session(self) -> int:
        """Create a new monitoring session. Returns the session id."""
        conn = self._get_conn()
        cur = conn.execute(
            "INSERT INTO sessions (started_at) VALUES (?)",
            (datetime.now().isoformat(),),
        )
        conn.commit()
        return cur.lastrowid  # type: ignore[return-value]

    def end_session(self, session_id: int):
        """Mark a session as ended and compute duration."""
        conn = self._get_conn()
        now = datetime.now().isoformat()
        conn.execute(
            """
            UPDATE sessions
               SET ended_at         = ?,
                   duration_seconds = CAST(
                       (julianday(?) - julianday(started_at)) * 86400 AS INTEGER
                   )
             WHERE id = ?
            """,
            (now, now, session_id),
        )
        conn.commit()
        # Rebuild all summaries for today
        today = date.today()
        self._rebuild_daily_summary(today.isoformat())
        self._rebuild_weekly_summary(today)
        self._rebuild_monthly_summary(today.year, today.month)

    # -- snapshots -----------------------------------------------------------

    def insert_snapshot(self, session_id: int, payload: Dict[str, Any]):
        """
        Persist one metric snapshot.
        `payload` should match the JSON structure already sent over the WS.
        """
        details = payload.get("details") or {}
        blink = details.get("blink", {})
        distance = details.get("distance", {})
        light = details.get("light", {})
        posture = details.get("posture", {})
        redness = details.get("redness", {})
        fusion = details.get("risk_fusion", {})

        conn = self._get_conn()
        conn.execute(
            """
            INSERT INTO snapshots (
                session_id, timestamp,
                blink_rate, ear, total_blinks, incomplete_blinks, is_dry,
                distance_cm, distance_risk,
                brightness, light_level, light_risk,
                head_position, posture_overall, pitch, yaw, roll,
                posture_risk, posture_score,
                redness, redness_level,
                strain_index, risk_score, risk_level
            ) VALUES (
                ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?,
                ?, ?,
                ?, ?, ?
            )
            """,
            (
                session_id,
                datetime.now().isoformat(),
                payload.get("blink_rate"),
                blink.get("ear"),
                blink.get("total_blinks"),
                blink.get("incomplete_blinks"),
                int(blink.get("is_dry", False)),
                payload.get("distance_cm"),
                distance.get("risk_score"),
                light.get("brightness"),
                light.get("level"),
                light.get("risk"),
                posture.get("head_position"),
                posture.get("overall"),
                posture.get("pitch"),
                posture.get("yaw"),
                posture.get("roll"),
                posture.get("risk"),
                payload.get("posture_score"),
                payload.get("redness"),
                redness.get("level"),
                payload.get("overall_strain_index"),
                fusion.get("score"),
                fusion.get("level"),
            ),
        )
        conn.commit()

    # -- alerts --------------------------------------------------------------

    def insert_alert(
        self,
        session_id: int,
        alert_type: str,
        severity: str,
        message: str,
    ):
        conn = self._get_conn()
        conn.execute(
            """
            INSERT INTO alerts (session_id, timestamp, alert_type, severity, message)
            VALUES (?, ?, ?, ?, ?)
            """,
            (session_id, datetime.now().isoformat(), alert_type, severity, message),
        )
        conn.commit()

    # -- daily summaries -----------------------------------------------------

    def _rebuild_daily_summary(self, iso_date: str):
        """Recompute the daily summary row for `iso_date` (YYYY-MM-DD)."""
        conn = self._get_conn()

        # Total session minutes today
        row = conn.execute(
            """
            SELECT COALESCE(SUM(duration_seconds), 0) / 60.0 AS total_min
              FROM sessions
             WHERE DATE(started_at) = ?
               AND duration_seconds IS NOT NULL
            """,
            (iso_date,),
        ).fetchone()
        total_min = row["total_min"] if row else 0

        # Averages from snapshots today
        avgs = conn.execute(
            """
            SELECT
                AVG(blink_rate)    AS avg_blink,
                AVG(distance_cm)   AS avg_dist,
                AVG(posture_score) AS avg_posture,
                AVG(brightness)    AS avg_bright,
                AVG(strain_index)  AS avg_strain,
                AVG(redness)       AS avg_redness,
                SUM(CASE WHEN is_dry = 1 THEN 1 ELSE 0 END) AS dry_count,
                SUM(CASE WHEN posture_risk >= 0.5 THEN 1 ELSE 0 END) AS bad_posture_count,
                COUNT(*) AS total_snaps
              FROM snapshots
             WHERE DATE(timestamp) = ?
            """,
            (iso_date,),
        ).fetchone()

        alert_count_row = conn.execute(
            "SELECT COUNT(*) AS cnt FROM alerts WHERE DATE(timestamp) = ?",
            (iso_date,),
        ).fetchone()
        alert_count = alert_count_row["cnt"] if alert_count_row else 0

        # Estimate minutes from snapshot count (snapshots are ~30 s apart)
        snap_count = avgs["total_snaps"] if avgs else 0
        dry_min = (avgs["dry_count"] or 0) * 0.5 if avgs else 0
        bad_posture_min = (avgs["bad_posture_count"] or 0) * 0.5 if avgs else 0

        conn.execute(
            """
            INSERT INTO daily_summaries (
                date, total_session_minutes,
                avg_blink_rate, avg_distance_cm, avg_posture_score,
                avg_brightness, avg_strain_index, avg_redness,
                alert_count, dry_eye_minutes, bad_posture_minutes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(date) DO UPDATE SET
                total_session_minutes = excluded.total_session_minutes,
                avg_blink_rate        = excluded.avg_blink_rate,
                avg_distance_cm       = excluded.avg_distance_cm,
                avg_posture_score     = excluded.avg_posture_score,
                avg_brightness        = excluded.avg_brightness,
                avg_strain_index      = excluded.avg_strain_index,
                avg_redness           = excluded.avg_redness,
                alert_count           = excluded.alert_count,
                dry_eye_minutes       = excluded.dry_eye_minutes,
                bad_posture_minutes   = excluded.bad_posture_minutes
            """,
            (
                iso_date,
                total_min,
                avgs["avg_blink"] if avgs else 0,
                avgs["avg_dist"] if avgs else 0,
                avgs["avg_posture"] if avgs else 0,
                avgs["avg_bright"] if avgs else 0,
                avgs["avg_strain"] if avgs else 0,
                avgs["avg_redness"] if avgs else 0,
                alert_count,
                dry_min,
                bad_posture_min,
            ),
        )
        conn.commit()

    # -- weekly summaries ----------------------------------------------------

    @staticmethod
    def _iso_week_range(d: date):
        """Return (week_start_monday, week_end_sunday) for the ISO week containing `d`."""
        week_start = d - timedelta(days=d.weekday())       # Monday
        week_end = week_start + timedelta(days=6)           # Sunday
        return week_start, week_end

    def _rebuild_weekly_summary(self, d: date):
        """Recompute the weekly summary row for the ISO week containing `d`."""
        iso_year, iso_week, _ = d.isocalendar()
        week_start, week_end = self._iso_week_range(d)
        start_str = week_start.isoformat()
        end_str = week_end.isoformat()

        conn = self._get_conn()

        row = conn.execute(
            """
            SELECT COALESCE(SUM(duration_seconds), 0) / 60.0 AS total_min
              FROM sessions
             WHERE DATE(started_at) BETWEEN ? AND ?
               AND duration_seconds IS NOT NULL
            """,
            (start_str, end_str),
        ).fetchone()
        total_min = row["total_min"] if row else 0

        avgs = conn.execute(
            """
            SELECT
                AVG(blink_rate)    AS avg_blink,
                AVG(distance_cm)   AS avg_dist,
                AVG(posture_score) AS avg_posture,
                AVG(brightness)    AS avg_bright,
                AVG(strain_index)  AS avg_strain,
                AVG(redness)       AS avg_redness,
                SUM(CASE WHEN is_dry = 1 THEN 1 ELSE 0 END) AS dry_count,
                SUM(CASE WHEN posture_risk >= 0.5 THEN 1 ELSE 0 END) AS bad_posture_count,
                COUNT(DISTINCT DATE(timestamp)) AS days_active
              FROM snapshots
             WHERE DATE(timestamp) BETWEEN ? AND ?
            """,
            (start_str, end_str),
        ).fetchone()

        alert_row = conn.execute(
            "SELECT COUNT(*) AS cnt FROM alerts WHERE DATE(timestamp) BETWEEN ? AND ?",
            (start_str, end_str),
        ).fetchone()
        alert_count = alert_row["cnt"] if alert_row else 0

        dry_min = (avgs["dry_count"] or 0) * 0.5 if avgs else 0
        bad_posture_min = (avgs["bad_posture_count"] or 0) * 0.5 if avgs else 0
        days_active = avgs["days_active"] if avgs else 0

        conn.execute(
            """
            INSERT INTO weekly_summaries (
                year, week, week_start, week_end,
                total_session_minutes,
                avg_blink_rate, avg_distance_cm, avg_posture_score,
                avg_brightness, avg_strain_index, avg_redness,
                alert_count, dry_eye_minutes, bad_posture_minutes, days_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(year, week) DO UPDATE SET
                week_start            = excluded.week_start,
                week_end              = excluded.week_end,
                total_session_minutes = excluded.total_session_minutes,
                avg_blink_rate        = excluded.avg_blink_rate,
                avg_distance_cm       = excluded.avg_distance_cm,
                avg_posture_score     = excluded.avg_posture_score,
                avg_brightness        = excluded.avg_brightness,
                avg_strain_index      = excluded.avg_strain_index,
                avg_redness           = excluded.avg_redness,
                alert_count           = excluded.alert_count,
                dry_eye_minutes       = excluded.dry_eye_minutes,
                bad_posture_minutes   = excluded.bad_posture_minutes,
                days_active           = excluded.days_active
            """,
            (
                iso_year, iso_week, start_str, end_str,
                total_min,
                avgs["avg_blink"] if avgs else 0,
                avgs["avg_dist"] if avgs else 0,
                avgs["avg_posture"] if avgs else 0,
                avgs["avg_bright"] if avgs else 0,
                avgs["avg_strain"] if avgs else 0,
                avgs["avg_redness"] if avgs else 0,
                alert_count,
                dry_min,
                bad_posture_min,
                days_active,
            ),
        )
        conn.commit()

    # -- monthly summaries ---------------------------------------------------

    def _rebuild_monthly_summary(self, year: int, month: int):
        """Recompute the monthly summary row for the given year/month."""
        # Date range for the month
        month_start = date(year, month, 1).isoformat()
        if month == 12:
            month_end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = date(year, month + 1, 1) - timedelta(days=1)
        month_end_str = month_end.isoformat()

        conn = self._get_conn()

        row = conn.execute(
            """
            SELECT COALESCE(SUM(duration_seconds), 0) / 60.0 AS total_min
              FROM sessions
             WHERE DATE(started_at) BETWEEN ? AND ?
               AND duration_seconds IS NOT NULL
            """,
            (month_start, month_end_str),
        ).fetchone()
        total_min = row["total_min"] if row else 0

        avgs = conn.execute(
            """
            SELECT
                AVG(blink_rate)    AS avg_blink,
                AVG(distance_cm)   AS avg_dist,
                AVG(posture_score) AS avg_posture,
                AVG(brightness)    AS avg_bright,
                AVG(strain_index)  AS avg_strain,
                AVG(redness)       AS avg_redness,
                SUM(CASE WHEN is_dry = 1 THEN 1 ELSE 0 END) AS dry_count,
                SUM(CASE WHEN posture_risk >= 0.5 THEN 1 ELSE 0 END) AS bad_posture_count,
                COUNT(DISTINCT DATE(timestamp)) AS days_active
              FROM snapshots
             WHERE DATE(timestamp) BETWEEN ? AND ?
            """,
            (month_start, month_end_str),
        ).fetchone()

        alert_row = conn.execute(
            "SELECT COUNT(*) AS cnt FROM alerts WHERE DATE(timestamp) BETWEEN ? AND ?",
            (month_start, month_end_str),
        ).fetchone()
        alert_count = alert_row["cnt"] if alert_row else 0

        dry_min = (avgs["dry_count"] or 0) * 0.5 if avgs else 0
        bad_posture_min = (avgs["bad_posture_count"] or 0) * 0.5 if avgs else 0
        days_active = avgs["days_active"] if avgs else 0

        conn.execute(
            """
            INSERT INTO monthly_summaries (
                year, month,
                total_session_minutes,
                avg_blink_rate, avg_distance_cm, avg_posture_score,
                avg_brightness, avg_strain_index, avg_redness,
                alert_count, dry_eye_minutes, bad_posture_minutes, days_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(year, month) DO UPDATE SET
                total_session_minutes = excluded.total_session_minutes,
                avg_blink_rate        = excluded.avg_blink_rate,
                avg_distance_cm       = excluded.avg_distance_cm,
                avg_posture_score     = excluded.avg_posture_score,
                avg_brightness        = excluded.avg_brightness,
                avg_strain_index      = excluded.avg_strain_index,
                avg_redness           = excluded.avg_redness,
                alert_count           = excluded.alert_count,
                dry_eye_minutes       = excluded.dry_eye_minutes,
                bad_posture_minutes   = excluded.bad_posture_minutes,
                days_active           = excluded.days_active
            """,
            (
                year, month,
                total_min,
                avgs["avg_blink"] if avgs else 0,
                avgs["avg_dist"] if avgs else 0,
                avgs["avg_posture"] if avgs else 0,
                avgs["avg_bright"] if avgs else 0,
                avgs["avg_strain"] if avgs else 0,
                avgs["avg_redness"] if avgs else 0,
                alert_count,
                dry_min,
                bad_posture_min,
                days_active,
            ),
        )
        conn.commit()

    # -- query helpers (for future API / AI analysis) ------------------------

    def get_sessions(self, limit: int = 20) -> List[Dict]:
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM sessions ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]

    def get_snapshots(
        self, session_id: Optional[int] = None, limit: int = 500
    ) -> List[Dict]:
        conn = self._get_conn()
        if session_id:
            rows = conn.execute(
                "SELECT * FROM snapshots WHERE session_id = ? ORDER BY id DESC LIMIT ?",
                (session_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM snapshots ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
        return [dict(r) for r in rows]

    def get_alerts(
        self, session_id: Optional[int] = None, limit: int = 100
    ) -> List[Dict]:
        conn = self._get_conn()
        if session_id:
            rows = conn.execute(
                "SELECT * FROM alerts WHERE session_id = ? ORDER BY id DESC LIMIT ?",
                (session_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM alerts ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
        return [dict(r) for r in rows]

    def get_daily_summaries(self, days: int = 30) -> List[Dict]:
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM daily_summaries ORDER BY date DESC LIMIT ?", (days,)
        ).fetchall()
        return [dict(r) for r in rows]

    def get_daily_summary(self, iso_date: str) -> Optional[Dict]:
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM daily_summaries WHERE date = ?", (iso_date,)
        ).fetchone()
        return dict(row) if row else None

    def get_weekly_summaries(self, weeks: int = 12) -> List[Dict]:
        """Return recent weekly summaries (default: last 12 weeks)."""
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM weekly_summaries ORDER BY year DESC, week DESC LIMIT ?",
            (weeks,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_weekly_summary(self, year: int, week: int) -> Optional[Dict]:
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM weekly_summaries WHERE year = ? AND week = ?",
            (year, week),
        ).fetchone()
        return dict(row) if row else None

    def get_monthly_summaries(self, months: int = 12) -> List[Dict]:
        """Return recent monthly summaries (default: last 12 months)."""
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM monthly_summaries ORDER BY year DESC, month DESC LIMIT ?",
            (months,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_monthly_summary(self, year: int, month: int) -> Optional[Dict]:
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM monthly_summaries WHERE year = ? AND month = ?",
            (year, month),
        ).fetchone()
        return dict(row) if row else None
