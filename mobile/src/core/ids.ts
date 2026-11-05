function fallbackUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const r = (Math.random() * 16) | 0;
    return (char === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function createId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? c.randomUUID() : fallbackUuid();
}
