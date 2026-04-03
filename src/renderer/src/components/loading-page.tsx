import { Package, Sparkles, Target, TrendingUp, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

const PlurseLoadingPage = () => {
  const [stage, setStage] = useState(0)

  const stages = [
    { icon: Package, scale: 0.8, opacity: 0.3 },
    { icon: Users, scale: 0.9, opacity: 0.5 },
    { icon: TrendingUp, scale: 1, opacity: 0.7 },
    { icon: Target, scale: 1.1, opacity: 0.9 },
    { icon: Sparkles, scale: 1.2, opacity: 1 }
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setStage((prev) => (prev < stages.length - 1 ? prev + 1 : prev))
    }, 800)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4 overflow-hidden">
      {/* Expanding circles representing growth */}
      <div className="absolute inset-0 flex items-center justify-center">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full border-2 border-blue-200/30"
            style={{
              width: `${(i + 1) * 120}px`,
              height: `${(i + 1) * 120}px`,
              animation: `expand 3s ease-out ${i * 0.3}s infinite`,
              opacity: stage >= i ? 1 : 0,
              transition: 'opacity 0.5s ease-in-out'
            }}
          />
        ))}
      </div>

      {/* Central content */}
      <div className="relative z-10 text-center">
        {/* Icon progression showing journey */}
        <div className="flex items-center justify-center gap-3 mb-12">
          {stages.map((item, index) => {
            const Icon = item.icon
            const isActive = index <= stage
            const isCurrent = index === stage

            return (
              <div key={index} className="relative">
                {/* Connection line */}
                {index < stages.length - 1 && (
                  <div
                    className="absolute top-1/2 left-full w-3 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 transition-all duration-500"
                    style={{
                      opacity: isActive ? 1 : 0.2,
                      transform: `scaleX(${isActive ? 1 : 0.5})`
                    }}
                  />
                )}

                {/* Icon */}
                <div
                  className={`relative rounded-full p-3 transition-all duration-500 ${
                    isCurrent
                      ? 'bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg'
                      : isActive
                        ? 'bg-gradient-to-br from-blue-400 to-purple-400'
                        : 'bg-gray-200'
                  }`}
                  style={{
                    transform: `scale(${isCurrent ? 1.2 : isActive ? 1 : 0.8})`,
                    opacity: isActive ? 1 : 0.3
                  }}
                >
                  {isCurrent && (
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 animate-ping opacity-40" />
                  )}
                  <Icon
                    className={`w-5 h-5 relative z-10 ${isActive ? 'text-white' : 'text-gray-400'}`}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Logo that grows and beats */}
        <div
          className="inline-flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-2xl mb-6 transition-all duration-700 animate-heartbeat"
          style={{
            width: `${60 + stage * 8}px`,
            height: `${60 + stage * 8}px`,
            transform: `rotate(${stage * 5}deg)`
          }}
        >
          <Package
            className="text-white animate-heartbeat"
            style={{ width: `${24 + stage * 4}px`, height: `${24 + stage * 4}px` }}
          />
        </div>

        {/* Brand name that becomes bolder and beats */}
        <h1
          className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent transition-all duration-500 animate-heartbeat"
          style={{
            fontSize: `${2.5 + stage * 0.3}rem`,
            fontWeight: 600 + stage * 100,
            letterSpacing: `${-0.02 + stage * 0.01}em`
          }}
        >
          Plurse
        </h1>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mt-8">
          {stages.map((_, index) => (
            <div
              key={index}
              className="rounded-full transition-all duration-300"
              style={{
                width: index === stage ? '32px' : '8px',
                height: '8px',
                backgroundColor: index <= stage ? '#3b82f6' : '#e5e7eb'
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes expand {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          50% {
            opacity: 0.3;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }

        @keyframes heartbeat {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(0.95);
          }
        }

        .animate-heartbeat {
          animation: heartbeat 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

export default PlurseLoadingPage
