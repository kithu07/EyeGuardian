import { HealthFailure } from './healthMetricsMonitor';

export function getRecommendations(failures: HealthFailure[]): string[] {
    const recs: string[] = [];
    failures.forEach(f => {
        switch (f.code) {
            case 'strain_critical':
            case 'strain_high':
                recs.push('Look away from the screen for 20 seconds.');
                break;
            case 'posture':
                recs.push('Adjust your posture: sit upright, relax shoulders.');
                break;
            case 'blink':
                recs.push('Blink frequently or do a blinking exercise.');
                break;
            case 'redness':
                recs.push('Close your eyes and rest for a moment.');
                break;
            case 'lighting':
                recs.push('Adjust ambient lighting to reduce glare.');
                break;
            case 'distance':
                recs.push('Move a bit further/closer to the screen to maintain proper distance.');
                break;
            default:
                recs.push(f.message);
        }
    });
    return recs;
}