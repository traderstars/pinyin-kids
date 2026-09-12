const lessons = JSON.parse(localStorage.getItem("little-mandarin-progress") || "{}");
const mastery = JSON.parse(localStorage.getItem("little-mandarin-mastery") || "{}");
const hanzi = window.CURRICULUM.tracks.find((track) => track.id === "hanzi");
const tracks = [...window.CURRICULUM.tracks, { ...hanzi, id: "cantonese", title: "粤语识字" }];
const allItems = tracks.map((track) => ({
  id: track.id,
  title: track.title,
  count: track.groups.flatMap((group) => group.items).length
}));
const learned = Object.keys(mastery).filter((key) => mastery[key].correct > 0).length;
const mastered = Object.keys(mastery).filter((key) => mastery[key].streak >= 3).length;
const misses = Object.values(mastery).reduce((sum, item) => sum + (item.misses || 0), 0);

document.querySelector("#statsGrid").innerHTML = `
  <div class="stat-card"><span class="stat-number">${Object.keys(lessons).length}</span>完成小课</div>
  <div class="stat-card"><span class="stat-number">${learned}</span>接触内容</div>
  <div class="stat-card"><span class="stat-number">${mastered}</span>连续答对3次</div>`;

const container = document.querySelector("#trackProgress");
allItems.forEach((track) => {
  const count = Object.entries(mastery).filter(([key, value]) => key.startsWith(`${track.id}_`) && value.correct > 0).length;
  const percent = Math.round(count / track.count * 100);
  const row = document.createElement("section");
  row.className = "track-progress";
  row.innerHTML = `<div class="track-progress-row"><span>${track.title}</span><span>${count} / ${track.count}</span></div><div class="mastery-bar"><div class="mastery-fill" style="width:${percent}%"></div></div>`;
  container.append(row);
});

if (misses) {
  const note = document.createElement("p");
  note.className = "grownup-note";
  note.textContent = `累计出现 ${misses} 次需要再想一想的内容，系统会自动安排复习。`;
  container.append(note);
}
