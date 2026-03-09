"""
Seed script for EyeGuardian database.
Populates daily_summaries, weekly_summaries, and monthly_summaries
with realistic data that shows POSITIVE PROGRESS over time.

Usage:
    python seed_data.py
"""

import sqlite3
import os
from datetime import date, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "eyeguardian.db")


def seed():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")

    today = date(2026, 3, 9)  # current date

    # =========================================================================
    # DAILY SUMMARIES — last 14 days, showing gradual improvement
    # =========================================================================
    # Day 1 (oldest): bad habits → Day 14 (today): good habits
    daily_data = []
    for i in range(14):
        d = today - timedelta(days=13 - i)  # oldest first
        progress = i / 13.0  # 0.0 → 1.0

        daily_data.append({
            "date": d.isoformat(),
            "total_session_minutes": 120 + i * 15,          # more usage over time
            "avg_blink_rate":        10 + progress * 8,      # 10 → 18 (improving)
            "avg_distance_cm":       35 + progress * 25,     # 35 → 60 (improving)
            "avg_posture_score":     55 + progress * 35,     # 55 → 90 (improving)
            "avg_brightness":        80 + progress * 60,     # 80 → 140 (improving)
            "avg_strain_index":      72 - progress * 45,     # 72 → 27 (improving = lower)
            "avg_redness":           0.82 - progress * 0.45, # 0.82 → 0.37 (improving = lower)
            "alert_count":           max(0, int(12 - progress * 10)),
            "dry_eye_minutes":       max(0, 30 - progress * 25),
            "bad_posture_minutes":   max(0, 60 - progress * 50),
        })

    for row in daily_data:
        conn.execute("""
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
        """, (
            row["date"], row["total_session_minutes"],
            round(row["avg_blink_rate"], 1),
            round(row["avg_distance_cm"], 1),
            round(row["avg_posture_score"], 1),
            round(row["avg_brightness"], 1),
            round(row["avg_strain_index"], 1),
            round(row["avg_redness"], 2),
            row["alert_count"],
            round(row["dry_eye_minutes"], 1),
            round(row["bad_posture_minutes"], 1),
        ))

    print(f"  ✓ Inserted {len(daily_data)} daily summaries")

    # =========================================================================
    # WEEKLY SUMMARIES — last 8 weeks, showing improvement
    # =========================================================================
    weekly_data = []
    for w in range(8):
        # week 0 = 8 weeks ago (bad), week 7 = current week (good)
        week_monday = today - timedelta(weeks=7 - w, days=today.weekday())
        week_sunday = week_monday + timedelta(days=6)
        iso_year, iso_week, _ = week_monday.isocalendar()
        progress = w / 7.0

        weekly_data.append({
            "year": iso_year,
            "week": iso_week,
            "week_start": week_monday.isoformat(),
            "week_end": week_sunday.isoformat(),
            "total_session_minutes": 600 + w * 80,
            "avg_blink_rate":        9 + progress * 9,       # 9 → 18
            "avg_distance_cm":       33 + progress * 27,     # 33 → 60
            "avg_posture_score":     50 + progress * 40,     # 50 → 90
            "avg_brightness":        75 + progress * 65,     # 75 → 140
            "avg_strain_index":      75 - progress * 48,     # 75 → 27
            "avg_redness":           0.85 - progress * 0.48, # 0.85 → 0.37
            "alert_count":           max(0, int(20 - progress * 16)),
            "dry_eye_minutes":       max(0, 50 - progress * 40),
            "bad_posture_minutes":   max(0, 120 - progress * 100),
            "days_active":           min(7, 3 + w),
        })

    for row in weekly_data:
        conn.execute("""
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
        """, (
            row["year"], row["week"], row["week_start"], row["week_end"],
            row["total_session_minutes"],
            round(row["avg_blink_rate"], 1),
            round(row["avg_distance_cm"], 1),
            round(row["avg_posture_score"], 1),
            round(row["avg_brightness"], 1),
            round(row["avg_strain_index"], 1),
            round(row["avg_redness"], 2),
            row["alert_count"],
            round(row["dry_eye_minutes"], 1),
            round(row["bad_posture_minutes"], 1),
            row["days_active"],
        ))

    print(f"  ✓ Inserted {len(weekly_data)} weekly summaries")

    # =========================================================================
    # MONTHLY SUMMARIES — last 6 months, showing improvement
    # =========================================================================
    monthly_data = []
    for m in range(6):
        # month 0 = 6 months ago (bad), month 5 = current month (good)
        month_date = today.replace(day=1) - timedelta(days=1)  # end of prev month
        # Go back (5 - m) months
        year = today.year
        month = today.month - (5 - m)
        while month <= 0:
            month += 12
            year -= 1

        progress = m / 5.0

        monthly_data.append({
            "year": year,
            "month": month,
            "total_session_minutes": 2400 + m * 400,
            "avg_blink_rate":        8 + progress * 10,      # 8 → 18
            "avg_distance_cm":       30 + progress * 30,     # 30 → 60
            "avg_posture_score":     45 + progress * 45,     # 45 → 90
            "avg_brightness":        70 + progress * 70,     # 70 → 140
            "avg_strain_index":      78 - progress * 50,     # 78 → 28
            "avg_redness":           0.88 - progress * 0.52, # 0.88 → 0.36
            "alert_count":           max(0, int(85 - progress * 70)),
            "dry_eye_minutes":       max(0, 210 - progress * 170),
            "bad_posture_minutes":   max(0, 540 - progress * 440),
            "days_active":           min(30, int(12 + progress * 18)),
        })

    for row in monthly_data:
        conn.execute("""
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
        """, (
            row["year"], row["month"],
            row["total_session_minutes"],
            round(row["avg_blink_rate"], 1),
            round(row["avg_distance_cm"], 1),
            round(row["avg_posture_score"], 1),
            round(row["avg_brightness"], 1),
            round(row["avg_strain_index"], 1),
            round(row["avg_redness"], 2),
            row["alert_count"],
            round(row["dry_eye_minutes"], 1),
            round(row["bad_posture_minutes"], 1),
            row["days_active"],
        ))

    print(f"  ✓ Inserted {len(monthly_data)} monthly summaries")

    conn.commit()
    conn.close()
    print(f"\n✅ Database seeded successfully: {DB_PATH}")
    print("   Data shows positive progress (improving habits over time)")


if __name__ == "__main__":
    seed()
