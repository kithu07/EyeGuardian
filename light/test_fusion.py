from risk_fusion import RiskFusionEngine

engine = RiskFusionEngine()

sample_risks = {
    "blink": 2,
    "redness": 1,
    "posture": 1,
    "distance": 0,
    "lighting": 2
}

print(engine.compute(sample_risks))
