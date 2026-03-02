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
                <div className="flex flex-col justify-center items-center py-12 space-y-4">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                    <p className="text-slate-400 text-sm animate-pulse">Analyzing your eye health data...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    <div className="space-y-6">
                        <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                            <h3 className="text-primary font-bold text-xs uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                                Usage Analysis
                            </h3>
                            <div className="text-slate-200 leading-relaxed text-[0.95rem] font-medium">
                                {typeof insights?.summary === 'string' ? insights.summary : JSON.stringify(insights?.summary)}
                            </div>
                        </div>

                        <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                            <h3 className="text-accent font-bold text-xs uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                                Precision Improvements
                            </h3>
                            <div className="text-slate-300 leading-relaxed text-sm">
                                {typeof insights?.improvements === 'string' ? insights.improvements : JSON.stringify(insights?.improvements)}
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-slate-900/60 to-slate-800/40 rounded-2xl p-6 border border-slate-700/50 shadow-inner relative group">
                        <div className="absolute -top-3 left-6 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
                            <h3 className="text-green-400 font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                </svg>
                                Expert Recommendations
                            </h3>
                        </div>

                        <ul className="space-y-4 mt-2">
                            {insights?.tips?.map((tip, index) => (
                                <li key={index} className="flex gap-4 group/item">
                                    <div className="mt-1 w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 group-hover/item:bg-green-500/20 transition-colors">
                                        <span className="text-green-500 text-[10px] font-black">{index + 1}</span>
                                    </div>
                                    <p className="text-slate-300 text-sm leading-relaxed group-hover/item:text-white transition-colors">
                                        {typeof tip === 'string' ? tip : JSON.stringify(tip)}
                                    </p>
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
