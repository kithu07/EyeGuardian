import React, { useState, useEffect } from 'react';

const AIInsights = () => {
    const [insights, setInsights] = useState<{ summary: string, improvements: string, tips: string[] } | null>(null);
    const [loading, setLoading] = useState(false);

    const fetchInsights = async (refresh = false) => {
        setLoading(true);
        try {
            const endpoint = refresh ? '/api/ai-insights/refresh' : '/api/ai-insights';
            const method = refresh ? 'POST' : 'GET';
            const response = await fetch(`http://localhost:8000${endpoint}`, { method });
            const data = await response.json();
            setInsights(data);
        } catch (error) {
            console.error('Error fetching AI insights:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInsights();
    }, []);

    // Remove early return to ensure container is always in layout
    // if (!insights && !loading) return null;

    return (
        <div className="bg-gradient-to-r from-slate-800/60 to-slate-900/60 border border-slate-700/50 rounded-2xl p-6 shadow-xl relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 right-0 p-4">
                <button
                    onClick={() => fetchInsights(true)}
                    disabled={loading}
                    className="p-2 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors border border-primary/20 group"
                    title="Refresh Insights"
                >
                    <svg
                        className={`w-5 h-5 text-primary ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0 animate-pulse">
                    <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                    </svg>
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-white mb-1">AI Eye Health Insights</h2>
                    <p className="text-slate-400 text-sm">Personalized analysis based on your usage patterns</p>
                </div>
            </div>

            {loading && !insights ? (
                <div className="flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-primary font-semibold text-sm uppercase tracking-wider mb-2">Usage Summary</h3>
                            <div className="text-slate-200 leading-relaxed text-sm">
                                {typeof insights?.summary === 'string' ? insights.summary : JSON.stringify(insights?.summary)}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-accent font-semibold text-sm uppercase tracking-wider mb-2">Areas for Improvement</h3>
                            <div className="text-slate-200 leading-relaxed text-sm">
                                {typeof insights?.improvements === 'string' ? insights.improvements : JSON.stringify(insights?.improvements)}
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-700/30">
                        <h3 className="text-green-400 font-semibold text-sm uppercase tracking-wider mb-3">Actionable Tips</h3>
                        <ul className="space-y-3">
                            {insights?.tips?.map((tip, index) => (
                                <li key={index} className="flex gap-3 text-slate-300 text-sm italic">
                                    <span className="text-green-500 font-bold">•</span>
                                    {typeof tip === 'string' ? tip : JSON.stringify(tip)}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIInsights;
