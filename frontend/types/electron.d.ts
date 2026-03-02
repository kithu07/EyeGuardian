interface ElectronAPI {
  sendNotification?: (title: string, body: string) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
