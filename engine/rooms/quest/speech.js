// Said aloud (band a). A Thai sentence can hold an English word ("...เป็นคำว่า map"); a th-TH voice mispronounces it, so the text is
// split into runs: Latin-letter runs get an en-US voice, the rest th-TH (English UI: one en-US utterance). Same guard as obby's
// speakParts: no speech support, an exception, or no installed voice for a language just skips that part.
const LATIN = /[A-Za-z][A-Za-z'’-]*(?:\s+[A-Za-z][A-Za-z'’-]*)*/g;

// text -> [{ text, lang }] (pure, so node tests can check it)
export function splitSpeech(text, uiLang = 'th'){
  const s = String(text || '').trim(); if (!s) return [];
  if (uiLang !== 'th') return [{ text: s, lang: 'en-US' }];
  const out = []; let at = 0, m; LATIN.lastIndex = 0;
  const push = (t, lang) => { t = t.trim(); if (t && /[^\s.,:;!?()·-]/.test(t)) out.push({ text: t, lang }); };
  while ((m = LATIN.exec(s))){ push(s.slice(at, m.index), 'th-TH'); push(m[0], 'en-US'); at = m.index + m[0].length; }
  push(s.slice(at), 'th-TH'); return out;
}

export function speakParts(parts){
  try { if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return;
    speechSynthesis.cancel(); const voices = (speechSynthesis.getVoices && speechSynthesis.getVoices()) || [];
    for (const { text, lang } of parts){ if (!text || (voices.length && !voices.some(v => String(v.lang).toLowerCase().startsWith(lang.slice(0, 2))))) continue;
      const u = new SpeechSynthesisUtterance(text); u.lang = lang; speechSynthesis.speak(u); } } catch (e) {}
}

export const speakMixed = (text, uiLang) => speakParts(splitSpeech(text, uiLang));
