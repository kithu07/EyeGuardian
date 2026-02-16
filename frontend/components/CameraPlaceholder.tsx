import React from 'react';

interface CameraPlaceholderProps extends React.HTMLAttributes<HTMLDivElement> {
    frameSrc?: string | null;
}

const CameraPlaceholder: React.FC<CameraPlaceholderProps> = ({ frameSrc, ...props }) => {
    return (
        <div {...props} className={`glass-panel rounded-2xl p-1 relative overflow-hidden flex items-center justify-center bg-black/40 aspect-video ${props.className || ''}`}>
            <div className="w-full h-full rounded-xl bg-slate-900 relative flex items-center justify-center overflow-hidden">
                {frameSrc ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                        src={frameSrc}
                        alt="Camera Feed"
                        className="w-full h-full object-contain"
                    />
                ) : (
                    <>
                        {/* Grid/Tech Pattern */}
                        <div className="absolute inset-0 opacity-20"
                            style={{ backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                        </div>

                        {/* Placeholder Text */}
                        <div className="text-center z-10">
                            <div className="w-16 h-16 rounded-full border-2 border-slate-700 flex items-center justify-center mx-auto mb-2 animate-pulse">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.818v6.364a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <p className="text-slate-500 font-mono text-sm">CAMERA INPUT: /dev/video0</p>
                            <p className="text-xs text-slate-700 mt-1">Awaiting Stream...</p>
                        </div>
                    </>
                )}

                {/* Corner Accents */}
                <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-primary/50"></div>
                <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-primary/50"></div>
                <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-primary/50"></div>
                <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-primary/50"></div>

                {/* Live Indicator */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-xs font-bold text-red-500 tracking-wider">LIVE</span>
                </div>
            </div>
        </div>
    );
};

export default CameraPlaceholder;
