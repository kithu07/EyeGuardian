interface ElectronAPI {
  sendNotification?: (title: string, body: string) => void;
  checkNotificationPermissions?: () => Promise<{ supported: boolean; granted: boolean }>;
  playSound?: (soundType: string) => void;
  playHighStrainSound?: () => void;
  playBreakReminderSound?: () => void;
  playPostureAlertSound?: () => void;
  playBlinkAlertSound?: () => void;
  playRednessAlertSound?: () => void;
  playLightingAlertSound?: () => void;
  playDistanceAlertSound?: () => void;
  playMultipleIssuesSound?: () => void;
  getAutoStartStatus?: () => Promise<boolean>;
  setAutoStart?: (enabled: boolean) => Promise<boolean>;
  getBackgroundMonitoring?: () => Promise<boolean>;
  setBackgroundMonitoring?: (enabled: boolean) => Promise<boolean>;
  onAppVisibilityChange?: (callback: (isVisible: boolean) => void) => void;
  startBreakMode?: () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
