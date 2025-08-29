'use client';

import React from 'react';
import { useProctoring, SecurityViolation } from '@/hooks/useProctoring';

interface ProctoringPanelProps {
  className?: string;
}

export default function ProctoringPanel({ className = '' }: ProctoringPanelProps) {
  const {
    isMonitoring,
    violations,
    cameraStatus,
    audioStatus,
    lastAnalysis,
    audioLevel,
    isAudioViolation,
    clearViolations,
  } = useProctoring();

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'analyzing': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      case 'idle': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString();
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Security Monitoring</h3>
          <div className="text-xs text-gray-500">Auto</div>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="p-4 border-b border-gray-100">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${getStatusColor(cameraStatus)}`}></div>
            <div>
              <p className="text-sm font-medium text-gray-700">Camera</p>
              <p className="text-xs text-gray-500 capitalize">{cameraStatus}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${getStatusColor(audioStatus)}`}></div>
            <div>
              <p className="text-sm font-medium text-gray-700">Audio</p>
              <p className="text-xs text-gray-500 capitalize">{audioStatus}</p>
            </div>
          </div>
        </div>
        
        {/* Audio Level Meter */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Audio Level</span>
            <span className={`text-xs font-medium ${isAudioViolation ? 'text-red-600' : 'text-gray-500'}`}>
              {isAudioViolation ? 'VIOLATION' : 'Normal'}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-200 ${
                isAudioViolation ? 'bg-red-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.round(audioLevel * 100)}%` }}
            />
          </div>
        </div>

        {lastAnalysis && (
          <p className="text-xs text-gray-500 mt-2">
            Last analysis: {formatTime(lastAnalysis)}
          </p>
        )}
      </div>

      {/* Violations */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700">
            Security Violations ({violations.length})
          </h4>
          {violations.length > 0 && (
            <button
              onClick={clearViolations}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear All
            </button>
          )}
        </div>

        {violations.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No violations detected
          </p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {violations.map((violation) => (
              <div
                key={violation.id}
                className={`p-3 rounded-md border ${getSeverityColor(violation.severity)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{violation.description}</p>
                    <p className="text-xs opacity-75 mt-1">
                      {formatTime(violation.timestamp)} • {violation.type}
                    </p>
                    {violation.details && (
                      <p className="text-xs opacity-75 mt-1">
                        {JSON.stringify(violation.details)}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                    violation.severity === 'high' ? 'bg-red-200 text-red-800' :
                    violation.severity === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-blue-200 text-blue-800'
                  }`}>
                    {violation.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100 bg-gray-50">
        <div className="text-xs text-gray-500 text-center">
          {isMonitoring ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Monitoring Active
            </span>
          ) : (
            <span>Monitoring Inactive</span>
          )}
        </div>
      </div>
    </div>
  );
}
