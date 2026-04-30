type Listener = (message: string) => void;

const listeners = new Set<Listener>();

export function showToast(message: string): void {
  if (listeners.size === 0) {
    console.warn('[toast] no host mounted; message dropped:', message);
    return;
  }
  listeners.forEach((listener) => listener(message));
}

export function subscribeToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
