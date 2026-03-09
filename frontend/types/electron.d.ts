interface ElectronAPI {
  sendNotification?: (title: string, body: string) => void;
  onAppVisibilityChange?: (callback: (isVisible: boolean) => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
