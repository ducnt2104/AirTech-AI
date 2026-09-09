import { Loader2, Sparkles } from 'lucide-react';

interface LoadingScreenProps {
  progress?: number;
  currentStep?: string;
}

export default function LoadingScreen({ progress = 0, currentStep = 'Đang khởi tạo hệ thống...' }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-white dark:bg-gray-900 z-50">
      <div className="text-center space-y-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto shadow-lg">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        </div>
        
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AIRTECH AI</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">AI-Powered Air Gesture Teaching Platform</p>
        </div>
        
        <div className="flex flex-col items-center gap-3 w-full max-w-md">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
            <span className="text-gray-600 dark:text-gray-400 text-sm">{currentStep}</span>
          </div>
          
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary-500 to-purple-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">
            {progress}%
          </div>
        </div>
      </div>
    </div>
  );
}