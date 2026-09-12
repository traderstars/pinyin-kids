const reviewState = JSON.parse(localStorage.getItem("little-mandarin-audio-review") || "{}");
const items = [];

const hanziTrack = window.CURRICULUM.tracks.find((track) => track.id === "hanzi");
const reviewTracks = [...window.CURRICULUM.tracks, { ...hanziTrack, id: "cantonese", title: "粤语识字" }];
reviewTracks.forEach((track) => {
  let index = 0;
  track.groups.forEach((group) => group.items.forEach((row) => {
    items.push({
      id: `${track.id}_${index++}`,
      track: track.title,
      group: group.title,
      symbol: row[0],
      example: track.id === "pinyin" ? row[1] : row[1],
      say: track.id === "pinyin" ? row[1] : track.id === "cantonese" ? `${row[0]}。${row[1]}。${row[0]}。` : row[2]
    });
  }));
});

let filter = "all";
let playing = null;

function save(id, status) {
  reviewState[id] = status;
  localStorage.setItem("little-mandarin-audio-review", JSON.stringify(reviewState));
  render();
}

function render() {
  const visible = items.filter((item) => filter === "all" || (filter === "pending" && !reviewState[item.id]) || reviewState[item.id] === filter);
  const passed = items.filter((item) => reviewState[item.id] === "passed").length;
  const flagged = items.filter((item) => reviewState[item.id] === "flagged").length;
  document.querySelector("#reviewCount").textContent = `已通过 ${passed} · 需重做 ${flagged} · 共 ${items.length}`;
  const list = document.querySelector("#reviewList");
  list.replaceChildren();
  visible.forEach((item) => {
    const row = document.createElement("article");
    row.className = `review-row ${reviewState[item.id] || "pending"}`;
    row.innerHTML = `<div class="review-symbol">${item.symbol}</div><div class="review-copy"><strong>${item.group}</strong><span>${item.say}</span></div><button class="play-review">▶ 试听</button><button class="pass-review">✓ 合格</button><button class="flag-review">! 重做</button>`;
    row.querySelector(".play-review").addEventListener("click", () => {
      playing?.pause();
      playing = new Audio(`audio/${item.id}.mp3`);
      playing.play();
    });
    row.querySelector(".pass-review").addEventListener("click", () => save(item.id, "passed"));
    row.querySelector(".flag-review").addEventListener("click", () => save(item.id, "flagged"));
    list.append(row);
  });
}

document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
  filter = button.dataset.filter;
  document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
  render();
}));

render();
