const SECRET = 'archive-secret-key';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function safeWorkerAsync(fn, context = '') {
  try {
    return await fn();
  } catch (err) {
    self.postMessage({
      error: true,
      context,
      message: err.message
    });

    throw err; // worker ko cleanly stop kar deta hai
  }
}

async function getKey() {//raw password ko real crypto key
  // 1️  - > do hashing (256-bit output)
  const hash = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode('archive-secret-key')
  );

  // 2️ --> hash ko AES-GCM key me import karo
  return crypto.subtle.importKey(
    'raw',
    hash,                      //  exactly 256 bits
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encrypt(data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey();

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(data))
  );

  return {
    iv: Array.from(iv),
    payload: Array.from(new Uint8Array(encrypted))
  };
}

async function decrypt(record) {
  const key = await getKey();

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(record.iv) },
    key,
    new Uint8Array(record.payload)
  );

  return JSON.parse(decoder.decode(decrypted));
}

self.onmessage = async (e) => {
  await safeWorkerAsync(async () => {
    const { type, tasks } = e.data;
    const total = tasks.length;
    const result = [];

    for (let i = 0; i < total; i++) {
      if (type === 'encrypt') {
        result.push(await encrypt(tasks[i]));
      }

      if (type === 'decrypt') {
        result.push(await decrypt(tasks[i]));
      }

      self.postMessage({
        progress: Math.round(((i + 1) / total) * 100)
      });
    }

    self.postMessage({ done: true, result });
  }, 'archive-worker');
};





