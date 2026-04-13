"""
Populate database with 6 months of sample health data for akshay@gmail.com
Shows good positive metrics for progress visualization
"""

import sqlite3
from datetime import datetime, timedelta
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "eyeguardian.db")

def populate_sample_data():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    user_email = "akshay@gmail.com"
    
    # Generate 6 months of data (180 days)
    base_date = datetime.now() - timedelta(days=180)
    
    print("Generating 6 months of health data...")
    
    snapshot_count = 0
    session_count = 0
    
    # For each day in the last 6 months
    for day_offset in range(180):
        current_date = base_date + timedelta(days=day_offset)
        session_start = current_date.replace(hour=9, minute=0, second=0).isoformat()
        session_end = current_date.replace(hour=10, minute=0, second=0).isoformat()
        
        # Insert session
        cur.execute(
            """INSERT INTO sessions (user_email, started_at, ended_at, duration_seconds)
               VALUES (?, ?, ?, ?)""",
            (user_email, session_start, session_end, 3600)
        )
        session_id = cur.lastrowid
        session_count += 1
        
        # Add 2 snapshots per day (every 30 min over 1 hour)
        for snap_offset in range(0, 2):
            snapshot_time = (current_date.replace(hour=9, minute=snap_offset*30, second=0)).isoformat()
            
            # Vary metrics slightly per day for realistic trends
            day_variation = day_offset % 10
            
            # Good metrics (positive values) with slight daily variation
            blink_rate = 15 + (day_variation % 4)  # 15-18 blinks/min (healthy)
            ear = 0.26 + (day_variation * 0.01)  # 0.26-0.36 (eyes open)
            total_blinks = 8 + (day_variation % 2)
            incomplete_blinks = 0  # Very few
            is_dry = 0  # Not dry
            
            distance_cm = 55 + (day_variation % 8)  # 55-63 cm (good distance)
            distance_risk = 0.0  # No distance risk
            
            brightness = 160 + (day_variation % 30)  # 160-190 (optimal lighting)
            light_level = "Good"
            light_risk = 0  # No lighting risk
            
            head_position = "Head Upright" if day_variation % 2 == 0 else "Slightly Forward"
            posture_overall = "Good Posture"
            pitch = 5 + (day_variation % 8)  # 5-13 degrees
            yaw = 2 + (day_variation % 4)  # 2-6 degrees
            roll = 1 + (day_variation % 2)  # 1-3 degrees
            posture_risk = 0.1 + (day_variation * 0.05)  # 0.1-0.5 (low risk)
            posture_score = 85 + (day_variation % 10)  # 85-95 (excellent)
            
            redness = 0.2 + (day_variation * 0.04)  # 0.2-0.6 (low to normal redness)
            redness_level = "Normal"
            
            strain_index = 15 + (day_variation % 15)  # 15-30 (very low strain)
            risk_score = strain_index / 100  # 0.15-0.30
            risk_level = "Low"
            
            cur.execute(
                """INSERT INTO snapshots (
                    session_id, user_email, timestamp,
                    blink_rate, ear, total_blinks, incomplete_blinks, is_dry,
                    distance_cm, distance_risk,
                    brightness, light_level, light_risk,
                    head_position, posture_overall, pitch, yaw, roll,
                    posture_risk, posture_score,
                    redness, redness_level,
                    strain_index, risk_score, risk_level
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    session_id, user_email, snapshot_time,
                    blink_rate, ear, total_blinks, incomplete_blinks, is_dry,
                    distance_cm, distance_risk,
                    brightness, light_level, light_risk,
                    head_position, posture_overall, pitch, yaw, roll,
                    posture_risk, posture_score,
                    redness, redness_level,
                    strain_index, risk_score, risk_level
                )
            )
            snapshot_count += 1
        
        # Commit every 10 days to avoid memory issues
        if day_offset % 10 == 0:
            conn.commit()
            print(f"  Progress: {day_offset}/180 days processed...")
    
    conn.commit()
    print(f"\n✅ Inserted {snapshot_count} snapshots across {session_count} sessions")
    
    # Rebuild summaries for all days
    print("Rebuilding daily/weekly/monthly summaries...")
    from database import EyeGuardianDB
    db = EyeGuardianDB(DB_PATH)
    
    for day_offset in range(180):
        current_date = base_date + timedelta(days=day_offset)
        iso_date = current_date.date().isoformat()
        
        try:
            db._rebuild_daily_summary(iso_date, user_email)
        except Exception as e:
            print(f"  Warning rebuilding daily {iso_date}: {e}")
        
        if day_offset % 7 == 0:
            try:
                db._rebuild_weekly_summary(current_date.date(), user_email)
            except Exception as e:
                print(f"  Warning rebuilding weekly: {e}")
        
        if day_offset % 30 == 0:
            try:
                db._rebuild_monthly_summary(current_date.year, current_date.month, user_email)
            except Exception as e:
                print(f"  Warning rebuilding monthly: {e}")
        
        if day_offset % 30 == 0:
            print(f"  Rebuilt summaries up to day {day_offset}...")
    
    # Final rebuild for current month
    now = datetime.now()
    db._rebuild_weekly_summary(now.date(), user_email)
    db._rebuild_monthly_summary(now.year, now.month, user_email)
    
    conn.close()
    print(f"\n✅ Database populated with 6 months of data for {user_email}!")
    print(f"   - Total Sessions: {session_count}")
    print(f"   - Total Snapshots: {snapshot_count}")
    print(f"   - Date Range: {(base_date).strftime('%Y-%m-%d')} to {(datetime.now()).strftime('%Y-%m-%d')}")
    print(f"   - Metrics: Healthy throughout (positive trends)")
    print(f"   - Ready for charts and AI insights!")

if __name__ == "__main__":
    populate_sample_data()
