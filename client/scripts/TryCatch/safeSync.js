export function safeSync(fn, { onError } = {}) {
  return function (...args) {
    try {
      return fn(...args);
    } catch (err) {
      console.error(' Sync error:', err);

      if (onError) {
        onError(err);
      }

      alert('⚠️ Unexpected error occurred.');
    }
  };
}
