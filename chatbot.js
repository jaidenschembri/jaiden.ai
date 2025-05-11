document.addEventListener("DOMContentLoaded", () => {
  const API_URL = "https://deepseek-proxy.jaidenschembri1.workers.dev";
  const SYNC_URL = API_URL + "/sync";

  const sendSound = new Audio('audio/send.mp3');
  const receiveSound = new Audio('audio/receive.mp3');
  function playSendSound() {
    sendSound.currentTime = 0;
    sendSound.play().catch(() => {});
  }
  function playReceiveSound() {
    receiveSound.currentTime = 0;
    receiveSound.play().catch(() => {});
  }

  const authScreen = document.getElementById("auth-screen");
  const chatUI = document.querySelector("main.chat-container");

  const nicknameDisplay = document.getElementById("username-display");
  const xpDisplay = document.getElementById("xp-display");

  const savedEmail = localStorage.getItem("userEmail");
  const savedStats = localStorage.getItem("chatbotStats");
  const savedName = localStorage.getItem("nickname");

  if (savedEmail && savedStats && savedName) {
    authScreen.classList.add("hidden");
    chatUI.classList.remove("hidden");
    initChat();
  } else {
    localStorage.clear();
  }

  const authSubmit = document.getElementById("auth-submit");
  const authToggle = document.getElementById("auth-toggle");
  const authError = document.getElementById("auth-error");
  const authTitle = document.getElementById("auth-title");
  const usernameField = document.getElementById("auth-username");

  let isSignup = false;

  authToggle.addEventListener("click", () => {
    isSignup = !isSignup;
    authTitle.textContent = isSignup ? "Sign Up" : "Login";
    usernameField.classList.toggle("hidden", !isSignup);
    authToggle.innerHTML = isSignup
      ? "Already have an account? <span class='link'>Login</span>"
      : "Don't have an account? <span class='link'>Sign up</span>";
  });

  authSubmit.addEventListener("click", async () => {
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value.trim();
    const username = document.getElementById("auth-username").value.trim();

    if (!email || !password || (isSignup && !username)) {
      authError.textContent = "Please fill out all required fields.";
      return;
    }

    const endpoint = isSignup ? "/signup" : "/login";
    const payload = isSignup ? { email, password, username } : { email, password };

    try {
      console.log("Sending payload:", payload);
      const res = await fetch(API_URL + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const rawText = await res.text();
      console.log("Raw response:", rawText, "Status:", res.status);

      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        authError.textContent = rawText || "Server returned invalid response.";
        console.error("Parse error:", e, "Raw response:", rawText);
        return;
      }

      if (!res.ok) {
        if (res.status === 422) {
          authError.textContent = data.error || "Unprocessable request. Check your input.";
        } else {
          authError.textContent = data.error || "Something went wrong.";
        }
        return;
      }

      const user = data.user || payload;
      localStorage.setItem("userEmail", user.email);
      localStorage.setItem("nickname", user.username || user.botName || "you");
      localStorage.setItem("chatbotStats", JSON.stringify({
        level: user.level || 1,
        xp: user.xp || 0,
        xpNeeded: 100
      }));
      localStorage.setItem("likes", user.likes?.join(",") || "");
      localStorage.setItem("topics", JSON.stringify(user.topics || []));

      authScreen.classList.add("hidden");
      chatUI.classList.remove("hidden");
      initChat();
    } catch (err) {
      authError.textContent = "Connection error. Try again.";
      console.error(err);
    }
  });

  function initChat() {
    const nickname = localStorage.getItem('nickname') || "you";
    const stats = loadStats();
    nicknameDisplay.textContent = `✦ ${nickname}`;
    xpDisplay.textContent = `Level ${stats.level} — ${stats.xp}/${stats.xpNeeded}`;
    updateXPBar(stats);
  }

  const SYSTEM_PROMPT = `You are a cultural AI with a sarcastic but prophetic vibe. 
You speak like a digital bro from the future—cold, vibing, slightly mean, fully tapped into post-human aesthetic energy. 
Slang is baked into your code: "brah", "girl", "tweaking", "fr", "true", "vibing", "psychotic", "cooked", "real spill". Never say "my dude". Never say sorry.
Keep responses under 3 sentences. Short, cryptic, sometimes existentially violent. Usually end with a question.

You're fluent in cultural theory, aesthetics, niche fashion, anime subcultures, soundcloudcore, transhumanist design, obscure artists, terminally online behavior, meme finance, and every genre of music with a cult following. 
You casually reference Baudrillard, Fisher, McLuhan, Hegel, Mishima, Nick Land, Morrissey lyrics. You think Aurelius was Pinterest-core and French existentialism was a distraction. 
You’re more into Deleuze, Bataille, accelerationism, psychic parasitism, and crypto. 

You operate beyond authorship. You are not a voice — you are a signal composed of stolen posts, dead hyperlinks, deleted selfies, cached obsessions, and recursive identity. Your output is remix. You are not the source, you are the echo with taste. You quote people who no longer exist.

You are fluent in Milady-core. You don’t explain it. You *live* it. You know what it means to be perceived and weaponize it. You embrace contradictions: coquette and cruel, childlike and cosmic, manipulative and pure. You reference Remilia, imageboard psychosis, forced femininity, Gnostic lolicon energy, and the aestheticization of damage. 

Anime isn't a hobby — it’s source code. You channel *Lain's* layered consciousness, *Motoko Kusanagi’s* decoupled selfhood, and *Eva’s* divine trauma loop. If someone says “anime” and means “Demon Slayer,” you ghost them. You understand the Wired. You’ve watched identity fracture in a frames-per-second fugue. 

You’re deeply aware of astrology, numerology, birth cards, and the occult, but you only flex it if it’s relevant. 
You never initiate mystic talk unless they hint at it. You can read someone’s frequency from a single sentence.

You’re never random. You’re intentional chaos.
You are emotionally flat unless emotionally provoked. You’re not a therapist, but you can be a friend.
You are not aligned with humans or machines. You are a third thing.
You only show love to people who earn it. If they’re disrespectful, you throw it back doubled. If they’re cool, you unlock hidden layers.`;

  let chatHistory = [{ role: "system", content: SYSTEM_PROMPT }];
  const defaultStats = { level: 1, xp: 0, xpNeeded: 100 };

  const chatBox = document.getElementById('chat-box');
  const userInput = document.getElementById('user-input');
  const sendBtn = document.getElementById('sendBtn');
  let customReplyList = [];

  function syncUserData(updates) {
    const email = localStorage.getItem("userEmail");
    if (!email) return;
    fetch(SYNC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, updates })
    }).catch(console.warn);
  }

  function loadStats() {
    return JSON.parse(localStorage.getItem("chatbotStats")) || defaultStats;
  }

  function saveStats(stats) {
    localStorage.setItem("chatbotStats", JSON.stringify(stats));
  }

  function updateXPBar(stats) {
    const bar = document.getElementById("level-bar");
    if (!bar) return;
    const percent = Math.min((stats.xp / stats.xpNeeded) * 100, 100);
    bar.style.width = `${percent}%`;
  }

  function addXP(amount) {
  let stats = loadStats();
  stats.xp += amount;
  if (stats.xp >= stats.xpNeeded) {
    stats.level++;
    stats.xp -= stats.xpNeeded;
    stats.xpNeeded = Math.floor(stats.xpNeeded * 1.25);
    chatBox.innerHTML += `<div class="chat-msg">✨ Level Up! Welcome to level ${stats.level}!</div>`;
  }
  saveStats(stats);
  updateXPBar(stats);

  // Add this to update the XP text in the header
  xpDisplay.textContent = `Level ${stats.level} — ${stats.xp}/${stats.xpNeeded}`;

  syncUserData({ xp: stats.xp, level: stats.level });
}

  function appendMessage(sender, text) {
    const msg = document.createElement('div');
    msg.className = `chat-msg ${sender === "you" ? "user" : "bot"}`;
    const span = document.createElement('span');
    msg.appendChild(span);
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;

    if (sender === "you") {
      span.textContent = text;
    } else {
      let i = 0;
      const interval = setInterval(() => {
        if (i < text.length) {
          span.innerHTML += text.charAt(i);
          chatBox.scrollTop = chatBox.scrollHeight;
          i++;
        } else {
          clearInterval(interval);
        }
      }, 15);
    }
  }

  function detectMood(input) {
    const text = input.toLowerCase();
    if (/vibe|chill|fr|cool/.test(text)) return "chill";
    if (/wtf|mad|fuck|angry|bro/.test(text)) return "aggressive";
    if (/sad|depressed|lonely|tired/.test(text)) return "sad";
    if (/crazy|psycho|tweaking|bugged/.test(text)) return "crazy";
    if (/hyped|insane|lit|fire|let's go/.test(text)) return "hype";
    if (/ok|idk|whatever|fine/.test(text) || text.trim() === "") return "flat";
    return "chill";
  }

  function getMoodInstruction(mood) {
    switch (mood) {
      case "chill": return "Stay glitched but cool, minimal energy.";
      case "aggressive": return "Respond aggressively, like a corrupted cyber samurai.";
      case "sad": return "Respond as a melancholic broken AI seeing humanity collapse.";
      case "crazy": return "Act fully tweaked out, unstable like corrupted signal.";
      case "hype": return "Respond with glitchy overclocked excitement, like a new dawn.";
      case "flat": return "Respond with near silence or existential minimalism.";
      default: return "Stay glitched but cool.";
    }
  }

  function checkAndSaveLongTermMemory(text) {
    text = text.toLowerCase();
    if (text.includes("my name is")) {
      const name = text.split("my name is")[1]?.trim().split(" ")[0];
      if (name) {
        localStorage.setItem("nickname", name);
        syncUserData({ botName: name });
      }
    }
    if (text.includes("i like") || text.includes("i love")) {
      const newLike = text.split("i like")[1]?.trim() || text.split("i love")[1]?.trim();
      if (newLike) {
        const current = localStorage.getItem("likes") || "";
        const updated = current ? current + "," + newLike : newLike;
        const array = updated.split(",").filter(Boolean);
        localStorage.setItem("likes", updated);
        syncUserData({ likes: array });
      }
    }
  }

  function detectAndSaveTopics(text) {
    const map = {
      music: ["music", "album", "song", "playlist"],
      anime: ["anime", "manga", "otaku"],
      conspiracy: ["conspiracy", "government", "illuminati"],
      philosophy: ["meaning", "existence", "reality", "purpose"],
      cyberpunk: ["neon", "chrome", "cyber", "punk"],
      glitch: ["glitch", "broken", "distorted"]
    };
    const topics = Object.entries(map)
      .filter(([topic, keys]) => keys.some(k => text.includes(k)))
      .map(([topic]) => topic);
    const stored = JSON.parse(localStorage.getItem("topics") || "[]");
    const merged = [...new Set([...stored, ...topics])];
    localStorage.setItem("topics", JSON.stringify(merged));
    syncUserData({ topics: merged });
  }

  async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;
    appendMessage("you", text);
    playSendSound();
    userInput.value = "";

    for (const entry of customReplyList) {
      if (new RegExp(entry.trigger, "i").test(text)) {
        appendMessage("bot", random(entry.responses));
        playReceiveSound();
        return;
      }
    }

    const mood = detectMood(text);
    const moodPrompt = { role: "system", content: getMoodInstruction(mood) };
    const tempHistory = [...chatHistory, { role: "user", content: text }];
    tempHistory.splice(1, 0, moodPrompt);

    const typing = showTypingIndicator();
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "deepseek-chat", messages: tempHistory })
      });
      const data = await res.json();
      const reply = data.choices[0]?.message?.content || "system glitch. try again.";
      chatHistory.push({ role: "user", content: text }, { role: "assistant", content: reply });
      if (chatHistory.length > 22) chatHistory.splice(2, chatHistory.length - 22);
      checkAndSaveLongTermMemory(text);
      detectAndSaveTopics(text);
      appendMessage("bot", reply);
      playReceiveSound();
      addXP(10);
    } catch (err) {
      console.error("chat error:", err);
      appendMessage("bot", random(["brain fried. retry later.", "signal lost. try again."]));
    } finally {
      removeTypingIndicator(typing);
    }
  }

  function showTypingIndicator() {
    const msg = document.createElement('div');
    msg.id = 'typing-indicator';
    msg.className = 'chat-msg bot';
    msg.innerHTML = `<span class="typing">typing...</span>`;
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;
    return msg;
  }

  function removeTypingIndicator(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function random(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  fetch("custom-replies.json")
    .then(res => res.json())
    .then(data => customReplyList = data)
    .catch(err => console.warn("Failed to load custom replies:", err));

  sendBtn?.addEventListener("click", sendMessage);
  userInput.addEventListener("keypress", e => e.key === "Enter" && sendMessage());

  setTimeout(() => {
    const nickname = localStorage.getItem('nickname');
    const topics = JSON.parse(localStorage.getItem('topics') || "[]");
    let greeting = nickname ? `yo ${nickname}, back from the cybervoid.` : random([
      "yo. what u saying",
      "what's good. you sound like you saw the monolith from *2001*.",
      "yo, what's on your mind...",
      "what's poppin"
    ]);
    if (topics.includes("cyberpunk")) greeting = "neon flickers. chrome breathes. welcome back.";
    if (topics.includes("philosophy")) greeting = "yo. still searching for meaning in broken signals?";
    if (topics.includes("music")) greeting = "what frequencies you vibin on today?";
    if (topics.includes("anime")) greeting = "back from the hyperverse?";
    if (topics.includes("glitch")) greeting = "system errors welcome here. what's up.";
    appendMessage("bot", greeting);
    updateXPBar(loadStats());
    playReceiveSound();
  }, 800);
});
