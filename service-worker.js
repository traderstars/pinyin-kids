const CACHE_NAME = "little-mandarin-v3";
const SHELL = [
  "./", "./index.html", "./review.html", "./styles.css", "./app.js", "./review.js",
  "./data/curriculum.js", "./manifest.webmanifest", "./assets/icon-180.png",
  "./assets/icon-192.png", "./assets/icon-512.png", "./audio/correct.mp3",
  "./audio/finished.mp3", "./audio/sound_on.mp3"
];
const COURSE_AUDIO = [
  ...Array.from({ length: 63 }, (_, index) => `./audio/pinyin_${index}.mp3`),
  ...Array.from({ length: 100 }, (_, index) => `./audio/hanzi_${index}.mp3`),
  ...Array.from({ length: 100 }, (_, index) => `./audio/cantonese_${index}.mp3`)
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
    await cache.addAll(SHELL);
    for (let start = 0; start < COURSE_AUDIO.length; start += 30) {
      await cache.addAll(COURSE_AUDIO.slice(start, start + 30));
    }
  }).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    return response;
  })));
});
