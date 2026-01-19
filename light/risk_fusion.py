class RiskFusionEngine:
    """
    Combines all ergonomic + visual risks into one score
    """

    def compute(self, risks: dict):
        weights = {
            "blink": 0.25,
            "redness": 0.25,
            "posture": 0.2,
            "distance": 0.15,
            "lighting": 0.15
        }

        score = 0.0
        for key, weight in weights.items():
            score += risks.get(key, 0) * weight

        if score < 0.7:
            level = "Low"
        elif score < 1.4:
            level = "Medium"
        else:
            level = "High"

        return {
            "risk_score": round(score, 2),
            "risk_level": level
        }
