const tracks = buildTracks(window.CURRICULUM);
const screens = [...document.querySelectorAll(".screen")];
const $ = (selector) => document.querySelector(selector);
const progress = JSON.parse(localStorage.getItem("little-mandarin-progress") || "{}");
const mastery = JSON.parse(localStorage.getItem("little-mandarin-mastery") || "{}");
let currentTrack, currentLesson, audioPlayer;
let currentLearn = 0, currentQuestion = 0, score = 0;
let activeQuestions = [], retryQueue = [], soundOn = true, locked = false;

function buildTracks(curriculum) {
  const hanziTrack = curriculum.tracks.find((track) => track.id === "hanzi");
  const sourceTracks = [...curriculum.tracks, { ...hanziTrack, id: "cantonese", title: "粤语识字", color: "#f5b9cc" }];
  return sourceTracks.map((track) => {
    let audioIndex = 0, lessonIndex = 0;
    const allItems = track.groups.flatMap((group) => group.items).map((row) => {
      const item = track.id === "pinyin"
        ? { symbol: row[0], word: row[0], say: row[1], picture: row[2] }
        : { symbol: row[0], word: row[1], say: track.id === "cantonese" ? `${row[0]}。${row[1]}。${row[0]}。` : row[2], picture: row[3] };
      item.audio = `${track.id}_${audioIndex++}`;
      return item;
    });
    let cursor = 0;
    const lessons = [];
    track.groups.forEach((group) => {
      const groupItems = allItems.slice(cursor, cursor + group.items.length);
      cursor += group.items.length;
      for (let start = 0; start < groupItems.length; start += 3) {
        const items = groupItems.slice(start, start + 3);
        lessons.push({ id: `${track.id}-${lessonIndex + 1}`, number: ++lessonIndex, group: group.title, title: `${group.title} ${Math.floor(start / 3) + 1}`, items });
      }
    });
    return { ...track, allItems, lessons };
  });
}

function showScreen(id) {
  screens.forEach((screen) => screen.classList.toggle("active", screen.id === id));
  $("#homeButton").classList.toggle("hidden", id === "homeScreen");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function speak(text, audioKey) {
  if (!soundOn) return;
  stopAudio();
  if (audioKey) {
    audioPlayer = new Audio(`audio/${audioKey}.mp3`);
    audioPlayer.play().catch(() => speakWithSystemVoice(text));
  } else speakWithSystemVoice(text);
}

function speakWithSystemVoice(text) {
  if (!("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 0.88;
  const voices = window.speechSynthesis.getVoices();
  utterance.voice = voices.find((voice) => /tingting|婷婷/i.test(voice.name)) || voices.find((voice) => voice.lang.replace("_", "-").toLowerCase() === "zh-cn") || null;
  window.speechSynthesis.speak(utterance);
}

function stopAudio() {
  audioPlayer?.pause();
  window.speechSynthesis?.cancel();
}

function goHome() {
  stopAudio();
  currentTrack = null;
  $("#pageTitle").textContent = "小小普通话乐园";
  refreshHome();
  showScreen("homeScreen");
}

function refreshHome() {
  const actions = $("#dailyActions");
  actions.replaceChildren();
  const dueByTrack = tracks.map((track) => ({ track, items: dueItems(track) })).filter((entry) => entry.items.length);
  if (dueByTrack.length) {
    $("#dailyMessage").textContent = `有 ${dueByTrack.reduce((sum, entry) => sum + entry.items.length, 0)} 个内容到复习时间了`;
    dueByTrack.forEach(({ track, items }) => {
      const button = document.createElement("button");
      button.className = "daily-button review";
      button.textContent = `${track.title}复习 ${Math.min(items.length, 6)}`;
      button.addEventListener("click", () => startReview(track, items));
      actions.append(button);
    });
    return;
  }
  const next = tracks.map((track) => ({ track, lesson: track.lessons.find((lesson) => !progress[lesson.id]) })).find((entry) => entry.lesson);
  if (!next) {
    $("#dailyMessage").textContent = "全部课程都完成啦，可以挑喜欢的再玩";
    return;
  }
  $("#dailyMessage").textContent = `建议继续：${next.lesson.title}`;
  const button = document.createElement("button");
  button.className = "daily-button";
  button.textContent = "开始今日小课 →";
  button.addEventListener("click", () => { currentTrack = next.track; startLesson(next.lesson); });
  actions.append(button);
}

function dueItems(track) {
  const now = Date.now();
  return track.allItems.filter((item) => mastery[item.audio]?.dueAt && Date.parse(mastery[item.audio].dueAt) <= now);
}

function startReview(track, items) {
  currentTrack = track;
  currentLesson = { id: `review-${track.id}`, title: "今日复习", group: "复习", items: items.slice(0, 6), isReview: true };
  currentLearn = currentLesson.items.length;
  currentQuestion = 0;
  score = 0;
  retryQueue = [];
  activeQuestions = currentLesson.items.map((item, index) => makeQuestion(item, index));
  $("#pageTitle").textContent = `${track.title}复习`;
  showScreen("gameScreen");
  renderQuestion();
  speak(activeQuestions[0].say, activeQuestions[0].audio);
}

function openTrack(trackId) {
  currentTrack = tracks.find((track) => track.id === trackId);
  $("#pageTitle").textContent = currentTrack.title;
  $("#courseTitle").textContent = currentTrack.title;
  $("#courseIcon").textContent = trackId === "pinyin" ? "🎈" : trackId === "cantonese" ? "🪭" : "🌱";
  renderLessonList();
  showScreen("courseScreen");
}

function renderLessonList() {
  const completed = currentTrack.lessons.filter((lesson) => progress[lesson.id]).length;
  $("#courseProgress").textContent = `已完成 ${completed} / ${currentTrack.lessons.length} 节`;
  const list = $("#lessonList");
  list.replaceChildren();
  let lastGroup = "";
  currentTrack.lessons.forEach((lesson) => {
    if (lesson.group !== lastGroup) {
      const heading = document.createElement("h3");
      heading.className = "lesson-group";
      heading.textContent = lesson.group;
      list.append(heading);
      lastGroup = lesson.group;
    }
    const button = document.createElement("button");
    button.className = "lesson-button";
    button.innerHTML = `<span class="lesson-number">${lesson.number}</span><span><span class="lesson-name">${lesson.title}</span><span class="lesson-content">${lesson.items.map((item) => item.symbol).join(" · ")}</span></span><span class="lesson-status">${progress[lesson.id] ? "★" : "☆"}</span>`;
    button.addEventListener("click", () => startLesson(lesson));
    list.append(button);
  });
}

function startLesson(lesson) {
  currentLesson = lesson;
  currentLearn = 0;
  currentQuestion = 0;
  score = 0;
  retryQueue = [];
  activeQuestions = lesson.items.map((item, index) => makeQuestion(item, index));
  $("#pageTitle").textContent = lesson.title;
  showScreen("learnScreen");
  renderLearn();
}

function renderLearn() {
  const item = currentLesson.items[currentLearn];
  $("#learnCount").textContent = `先认识 ${currentLearn + 1} / ${currentLesson.items.length}`;
  $("#learnPicture").textContent = item.picture;
  $("#learnMain").textContent = item.symbol;
  $("#learnExample").textContent = currentTrack.id === "pinyin" ? item.say : item.word;
  $("#learnNextButton").textContent = currentLearn === currentLesson.items.length - 1 ? "开始练习 →" : "我认识了 →";
  speak(item.say, item.audio);
}

function nextLearn() {
  currentLearn += 1;
  if (currentLearn < currentLesson.items.length) return renderLearn();
  currentQuestion = 0;
  showScreen("gameScreen");
  renderQuestion();
  speak(activeQuestions[0].say, activeQuestions[0].audio);
}

function makeQuestion(item, index) {
  const others = currentTrack.allItems.filter((candidate) => candidate.symbol !== item.symbol);
  const distractors = [others[(item.audio.length * 7 + index * 11) % others.length], others[(item.audio.length * 13 + index * 17 + 5) % others.length]];
  const choices = [...new Set([item.symbol, ...distractors.map((entry) => entry.symbol)])];
  while (choices.length < 3) choices.push(others[choices.length].symbol);
  const shift = index % choices.length;
  return { ...item, answer: item.symbol, choices: [...choices.slice(shift), ...choices.slice(0, shift)], isRetry: false };
}

function renderQuestion() {
  locked = false;
  const question = activeQuestions[currentQuestion];
  const total = currentLesson.items.length;
  $("#roundLabel").textContent = question.isRetry ? "加练一题" : `第 ${currentQuestion + 1} 题 / ${total}`;
  $("#progressBar").style.width = `${Math.min((currentQuestion + 1) / total, 1) * 100}%`;
  $("#stars").textContent = Array.from({ length: total }, (_, index) => index < score ? "★" : "☆").join(" ");
  $("#picture").textContent = currentTrack.id === "pinyin" ? "👂" : question.picture;
  $("#prompt").textContent = currentTrack.id === "pinyin" ? "听一听，选出正确的拼音" : `${question.word}，请选择正确的字`;
  $("#feedback").textContent = "";
  $("#answers").replaceChildren();
  question.choices.forEach((choice) => {
    const button = document.createElement("button");
    button.className = "answer-button";
    button.textContent = choice;
    button.addEventListener("click", () => checkAnswer(button, choice));
    $("#answers").append(button);
  });
}

function checkAnswer(button, choice) {
  if (locked) return;
  const question = activeQuestions[currentQuestion];
  if (choice !== question.answer) {
    if (!question.missRecorded) {
      recordAttempt(question, false);
      question.missRecorded = true;
    }
    if (!question.isRetry && !retryQueue.includes(currentQuestion)) retryQueue.push(currentQuestion);
    button.classList.add("wrong");
    $("#feedback").textContent = "再听一次，慢慢找～";
    speak(question.say, question.audio);
    setTimeout(() => button.classList.remove("wrong"), 500);
    return;
  }
  locked = true;
  if (!question.isRetry) recordAttempt(question, true);
  if (!question.isRetry) score += 1;
  button.classList.add("correct");
  $("#feedback").textContent = "答对啦！真棒！";
  speak("答对啦！真棒！", "correct");
  setTimeout(advanceQuestion, 1000);
}

function recordAttempt(item, correct) {
  const state = mastery[item.audio] || { correct: 0, misses: 0, streak: 0 };
  if (correct) {
    state.correct += 1;
    state.streak += 1;
    const intervals = [1, 2, 4, 7, 14, 30];
    const days = intervals[Math.min(state.streak - 1, intervals.length - 1)];
    state.dueAt = new Date(Date.now() + days * 86400000).toISOString();
  } else {
    state.misses += 1;
    state.streak = 0;
    state.dueAt = new Date(Date.now() + 86400000).toISOString();
  }
  mastery[item.audio] = state;
  localStorage.setItem("little-mandarin-mastery", JSON.stringify(mastery));
}

function advanceQuestion() {
  currentQuestion += 1;
  if (currentQuestion < activeQuestions.length) {
    renderQuestion();
    return setTimeout(() => speak(activeQuestions[currentQuestion].say, activeQuestions[currentQuestion].audio), 150);
  }
  if (retryQueue.length) {
    const retry = activeQuestions[retryQueue.shift()];
    activeQuestions.push({ ...retry, isRetry: true });
    renderQuestion();
    $("#feedback").textContent = "再练一次，就记牢啦";
    return setTimeout(() => speak(retry.say, retry.audio), 150);
  }
  finishLesson();
}

function finishLesson() {
  if (!currentLesson.isReview) {
    progress[currentLesson.id] = { completedAt: new Date().toISOString(), score };
    localStorage.setItem("little-mandarin-progress", JSON.stringify(progress));
  }
  showScreen("finishScreen");
  $("#finishMessage").textContent = `你认识了 ${currentLesson.items.length} 个新朋友`;
  $("#finishStars").textContent = Array(currentLesson.items.length).fill("⭐").join(" ");
  speak("完成啦！你得到五颗小星星。", "finished");
}

document.querySelectorAll("[data-track]").forEach((button) => button.addEventListener("click", () => openTrack(button.dataset.track)));
$("#homeButton").addEventListener("click", goHome);
$("#finishHomeButton").addEventListener("click", () => openTrack(currentTrack.id));
$("#againButton").addEventListener("click", () => startLesson(currentLesson));
$("#learnNextButton").addEventListener("click", nextLearn);
$("#learnListenButton").addEventListener("click", () => { const item = currentLesson.items[currentLearn]; speak(item.say, item.audio); });
$("#listenButton").addEventListener("click", () => { const question = activeQuestions[currentQuestion]; speak(question.say, question.audio); });
$("#soundButton").addEventListener("click", () => {
  soundOn = !soundOn;
  $("#soundButton").textContent = soundOn ? "🔊" : "🔇";
  if (!soundOn) stopAudio(); else speak("声音打开啦", "sound_on");
});
window.speechSynthesis?.getVoices();
refreshHome();
