// Original background songs, written as notes and played by the small synth in music.js (owner 2026-11-27:
// the old waltz felt dizzy and boring; choose a new island song, and each islander gets their own song while you talk).
// A song: bpm, beats per bar, swing (0 = straight, .6 = lazy shuffle), chords (one per bar, cycled), melody bars,
// and which instruments play. Notes are "C5:1" (name+octave : beats), "-:1" is a rest, "~" ties into the next note.
// Keep songs calm: no constant fast arpeggio (that was what made the old one dizzy), plenty of rests in the tune.

export const SONGS = {
  // ---- recorded tracks (owner chose these on 2026-11-27); the file is audio/bgm-<id>.mp3, both CC0 from OpenGameArt (see audio/CREDITS.md)
  cider:  { th: 'แอปเปิลไซเดอร์', en: 'Apple Cider', mood: 'อบอุ่นแบบเกมฟาร์ม กีตาร์ ผิวปาก ฟลุต', file: true, by: 'Zane Little Music' },
  garden: { th: 'ป่วนในสวน', en: 'Trouble in the Garden', mood: 'กวน ๆ ซน ๆ แบบแอบย่อง', file: true, by: 'Augmentality (Brandon Morris)' },
  stroll: {
    th: 'เดินเล่นวันแดดดี', en: 'Sunny Stroll', mood: 'สบาย ๆ เดินเล่นสำรวจเกาะ', bpm: 92, beats: 4, swing: .12,
    lead: 'kalimba', bass: 'pluck', pad: true, drums: 'brush',
    chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G'],
    melody: [
      'E5:1 G5:1 A5:.5 G5:.5 E5:1', 'C5:1.5 D5:.5 E5:2', 'F5:1 A5:1 G5:.5 F5:.5 E5:1', 'D5:3 -:1',
      'E5:1 G5:1 C6:.5 B5:.5 A5:1', 'A5:1 G5:1 E5:2', 'F5:1 E5:.5 D5:.5 C5:1 D5:1', 'G4:2 -:2',
      'C5:.5 E5:.5 G5:1 G5:1 A5:1', 'E5:2 C5:1 -:1', 'A4:.5 C5:.5 F5:1 E5:1 D5:1', 'B4:2 D5:2',
      'E5:1 D5:1 C5:1 E5:1', 'C5:1 A4:1 C5:2', 'D5:1 F5:1 A5:1 F5:1', 'G5:2 -:1 G4:1'
    ]
  },
  meadow: {
    th: 'ทุ่งหญ้าลมพัด', en: 'Breezy Meadow', mood: 'นุ่ม ๆ ไหลไปเรื่อย ๆ จังหวะโยกเบา ๆ', bpm: 72, beats: 3, swing: 0,
    lead: 'marimba', bass: 'soft', pad: true, drums: 'shaker',
    chords: ['G', 'Em', 'C', 'D', 'G', 'C', 'Am', 'D'],
    melody: [
      'B4:1 D5:1 G5:1', 'E5:2 D5:1', 'C5:1 E5:1 G5:1', 'F#5:2 -:1',
      'G5:1 B5:1 A5:1', 'G5:1 E5:2', 'C5:1 E5:1 D5:1', 'D5:3',
      'D5:1 G5:1 B5:1', 'B5:1 A5:1 G5:1', 'E5:1 G5:1 C6:1', 'A5:2 -:1',
      'G5:1 F#5:1 G5:1', 'E5:1 C5:2', 'E5:1 D5:1 C5:1', 'A4:2 D5:1'
    ]
  },
  lazy: {
    th: 'บ่ายขี้เกียจ', en: 'Lazy Afternoon', mood: 'ชิล ๆ แบบโลไฟ เหมาะตอนสร้างบ้าน', bpm: 78, beats: 4, swing: .55,
    lead: 'epiano', bass: 'soft', pad: true, drums: 'lofi',
    chords: ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'],
    melody: [
      'A5:1.5 G5:.5 E5:1 C5:1', 'D5:1 E5:.5 G5:1.5 -:1', 'F5:1 E5:.5 D5:.5 C5:1 A4:1', 'G4:3 -:1',
      'C5:.5 D5:.5 E5:1 G5:1 A5:1', 'B5:1 A5:.5 G5:1.5 -:1', 'A5:1 F5:1 D5:1 E5:1', 'C5:3 -:1'
    ]
  },
  hop: {
    th: 'กระโดดกระเด้ง', en: 'Hop Along', mood: 'สดใส มีพลัง ชวนวิ่งเล่น', bpm: 108, beats: 4, swing: .08,
    lead: 'uke', bass: 'bounce', pad: false, drums: 'pop',
    chords: ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A'],
    melody: [
      'F#5:.5 A5:.5 -:.5 A5:.5 B5:1 A5:1', 'E5:1 C#5:.5 E5:.5 A5:2', 'F#5:.5 D5:.5 -:.5 F#5:.5 B5:1 A5:1', 'G5:2 -:2',
      'A5:.5 B5:.5 A5:.5 F#5:.5 D5:1 F#5:1', 'E5:.5 F#5:.5 E5:.5 C#5:.5 A4:2', 'B4:1 D5:1 G5:1 F#5:.5 G5:.5', 'A5:3 -:1'
    ]
  },
  // ---- islanders' talk songs: they play while you talk to that islander
  fox: {
    th: 'จิ้งจอกซิ่งมาแล้ว', en: 'Zoomy Swagger', mood: 'กวน ๆ ซ่า ๆ เดินย่องแบบเท่ ๆ', bpm: 116, beats: 4, swing: .62,
    lead: 'whistle', bass: 'walk', pad: false, drums: 'claps',
    chords: ['Am', 'Am', 'Dm', 'E7', 'Am', 'F', 'E7', 'E7'],
    melody: [
      'E5:.5 -:.5 E5:.5 G5:.5 A5:1 -:1', 'C6:.5 B5:.5 A5:.5 G5:.5 E5:1 -:1', 'F5:.5 -:.5 F5:.5 A5:.5 D6:1 C6:.5 A5:.5', 'G#5:2 -:1 B4:.5 C5:.5',
      'E5:.5 -:.5 E5:.5 G5:.5 A5:1 C6:.5 E6:.5', 'D6:.5 C6:.5 A5:1 F5:1 -:1', 'E5:.5 F5:.5 G#5:.5 B5:.5 D6:1 C6:.5 B5:.5', 'A5:1 -:1 E5:.5 -:.5 A4:1'
    ]
  }
};
// which song an islander plays while you talk to them
export const TALK_SONGS = { sing: 'garden' };   // Zoomy Fox: 'garden' (recorded); 'fox' is the code-made alternative
export const ISLAND_SONGS = ['cider', 'stroll', 'meadow', 'lazy', 'hop'];
