import json
import os
import time
import threading
from groq import Groq


class AIInsightsManager:
    def __init__(self, api_key: str, cache_path: str, db=None, dummy_data_path: str = None):
        self.api_key = api_key
        self.cache_path = cache_path
        self.db = db
        self.dummy_data_path = dummy_data_path
        # Using the model recommended by the user
        self.model = "llama-3.1-8b-instant"
        self._lock = threading.Lock()
        self.client = Groq(api_key=self.api_key)

    def _get_data(self, user_email: str = None):
        """Query the database for real weekly/monthly stats.
        Falls back to dummy JSON file if DB has no data."""
        # Try real DB first
        if self.db is not None:
            try:
                data = self.db.get_insights_data(user_email)
                # Check if we actually have data (non-empty weekly_stats)
                if data.get("weekly_stats"):
                    return data
            except Exception as e:
                print(f"[AIInsights] Error querying DB: {e}")

        # Fallback to dummy data file if available
        if self.dummy_data_path and os.path.exists(self.dummy_data_path):
            with open(self.dummy_data_path, 'r') as f:
                return json.load(f)

        return {}

    def get_insights(self, user_email: str = None, force_refresh: bool = False):
        if not force_refresh and os.path.exists(self.cache_path):
            with open(self.cache_path, 'r') as f:
                cache = json.load(f)
                # Check if cache is reasonably recent (e.g., within 1 hour)
                if time.time() - cache.get("timestamp", 0) < 3600:
                    return cache.get("insights")

        return self.generate_insights(user_email)

    def generate_insights(self, user_email: str = None):
        # Ensure only one request is sent at a time
        if not self._lock.acquire(blocking=False):
            return {
                "summary": "Another insight generation is currently in progress.",
                "improvements": "Please wait a moment.",
                "tips": ["Try refreshing again in a few seconds."]
            }
        
        try:
            data = self._get_data(user_email)
            w_raw = data.get('weekly_stats', {})
            m_raw = data.get('monthly_stats', {})

            # Round all numeric values to 2 decimal places
            def _r(val, ndigits=2):
                try:
                    return round(float(val), ndigits)
                except (TypeError, ValueError):
                    return val

            w = {k: _r(v) for k, v in w_raw.items()}
            m = {k: _r(v) for k, v in m_raw.items()}
            
            prompt = f"""
            You are an AI Eye Health Expert. Based on the following user patterns captured by the EyeGuardian app, 
            provide a concise summary of their eye health, suggest what they need to improve, 
            and provide 3-4 actionable tips to restore their eye health.

            CRITICAL: You MUST cite the specific CURRENT METRICS in your summary to prove this is data-backed.
            For example: "Your blink rate of {w.get('avg_blink_rate')} bpm is below the healthy range..."

            USER METRICS (WEEKLY AVERAGES):
            - Eye Strain Index: {w.get('avg_strain_index')}%
            - Blink Rate: {w.get('avg_blink_rate')} blinks/min (Healthy: 15-20)
            - Screen Distance: {w.get('avg_distance_cm')} cm (Healthy: 50-70)
            - Posture Score: {w.get('avg_posture_score')}% (Healthy: 85+)
            - Ambient Brightness: {w.get('avg_brightness')} (Healthy: 100-180)
            - Eye Redness: {w.get('avg_redness')} (Scale: 0.0-1.0)
            - Total Usage: {round(w.get('total_session_minutes', 0)/60, 1)} hours
            - Total Alerts: {w.get('alert_count')} (Includes dry eyes, bad posture, etc.)
            - Bad Posture Duration: {w.get('bad_posture_minutes')} minutes

            MONTHLY AVERAGES:
            - Eye Strain Index: {m.get('avg_strain_index')}%
            - Blink Rate: {m.get('avg_blink_rate')} blinks/min
            - Posture Score: {m.get('avg_posture_score')}%
            - Monthly Alert Count: {m.get('alert_count')}

            Analysis requirements:
            1. Citations: Explicitly mention at least 2 current numbers from the metrics above in your summary.
            2. Formatting: The "summary" and "improvements" fields MUST be plain strings, NOT objects.
            3. Tone: Professional, encouraging, and scientific.
            4. Tips: Provide 3-4 clear, actionable bullet points.

            Respond ONLY with a valid JSON object with keys: "summary", "improvements", "tips".
            """

            completion = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=1,
                max_tokens=1024,
                top_p=1,
                stream=False,
                response_format={"type": "json_object"}
            )
            
            content_text = completion.choices[0].message.content
            insights = json.loads(content_text)
            
            # Ensure required keys exist and are in the correct format
            if not isinstance(insights, dict):
                insights = {}

            # Helper to flatten objects/lists into descriptive strings
            def flatten_to_string(val):
                if isinstance(val, str):
                    return val
                if isinstance(val, dict):
                    return " ".join([f"{k.replace('_', ' ').capitalize()}: {flatten_to_string(v)}" for k, v in val.items()])
                if isinstance(val, list):
                    return " ".join([flatten_to_string(v) for v in val])
                return str(val)

            # Process summary
            insights["summary"] = flatten_to_string(insights.get("summary", "No summary provided."))
            
            # Process improvements
            insights["improvements"] = flatten_to_string(insights.get("improvements", "No specific improvements identified."))
            
            # Process tips (ensure it's a list of strings)
            raw_tips = insights.get("tips", [])
            if not isinstance(raw_tips, list):
                raw_tips = [str(raw_tips)]
            
            clean_tips = []
            for t in raw_tips:
                if isinstance(t, dict):
                    # Try to find a 'tip' or 'text' key, otherwise join values
                    tip_text = t.get("tip") or t.get("text") or " ".join([str(v) for v in t.values()])
                    clean_tips.append(tip_text)
                else:
                    clean_tips.append(str(t))
            
            insights["tips"] = clean_tips or ["Stay hydrated", "Blink often", "Take breaks"]
            
            # Cache the result
            cache = {
                "timestamp": time.time(),
                "insights": insights
            }
            with open(self.cache_path, 'w') as f:
                json.dump(cache, f, indent=2)
                
            return insights
        except Exception as e:
            print(f"Error calling Groq API: {e}")
            return {
                "summary": f"Could not generate insights: {e}",
                "improvements": "Our AI Eye Expert is temporarily unavailable.",
                "tips": [
                    "Blink more often (15-20 times per minute)",
                    "Follow the 20-20-20 rule",
                    "Ensure your screen is 50-70cm away",
                    "Maintain an upright posture"
                ]
            }
        finally:
            self._lock.release()
