export function safeAsync(fn, { onError, silent = false } = {}) {
  return async function (...args) {
    try {
      return await fn(...args);
    } catch (err) {
      console.error(' Async error:', err);

      if (onError) onError(err);

      if (!silent) {//If silent = true is not passed in the API call, and res.ok is false, then show the error here.
        alert('⚠️ Something went wrong. Please try again.');
      }
    }
  };
}
