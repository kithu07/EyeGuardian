// Evaluate incoming health state and flag any metric failures.
// Exported functions and types are used by page.tsx to decide when to show alerts.

export interface HealthState {
    blink_rate: number;
    distance_cm: number;
    posture_score: number;
    ambient_light: number;
    overall_strain_index: number;
    redness: number;
    camera_frame: string | null;
    details: any | null;
}

export interface HealthFailure {
    code: string;
    message: string;
}

export function evaluateHealthState(state: HealthState): HealthFailure[] {
    const failures: HealthFailure[] = [];

    // strain
    if (state.overall_strain_index >= 80) {
        failures.push({ code: 'strain_critical', message: 'Critical eye strain' });
    } else if (state.overall_strain_index >= 70) {
        failures.push({ code: 'strain_high', message: 'High eye strain' });
    }

    // posture
    if (state.posture_score < 60 || (state.details?.posture?.risk ?? 0) > 0.5) {
        failures.push({ code: 'posture', message: 'Poor posture detected' });
    }

    // blink rate
    if (state.blink_rate < 15) {
        failures.push({ code: 'blink', message: 'Low blink rate' });
    }

    // redness
    if (state.redness > 0.7) {
        failures.push({ code: 'redness', message: 'Eye redness' });
    }

    // lighting
    if (state.details?.light?.risk > 1) {
        failures.push({ code: 'lighting', message: 'Improper lighting' });
    }

    // distance
    if (state.details?.distance?.risk_score > 0.5) {
        failures.push({ code: 'distance', message: 'Screen distance issue' });
    }

    return failures;
}
