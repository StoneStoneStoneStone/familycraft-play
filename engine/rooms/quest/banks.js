// Content banks for the quest rooms (pure data). Phonics Phase 2-5 for band a, times tables for b, fractions for c.
export const BANKS = {
  // a = Phase 2-5 (Rec-Y1); b = Phase 6 (affixes, homophones, contractions); c = Y5-6 spelling list
  phonics: {
    a: ['s','a','t','p','i','n','m','d','g','o','c','k','ck','e','u','r','h','b','f','l','j','v','w','x','y','z','qu',
        'sh','ch','th','ng','ai','ee','igh','oa','oo','ar','or','ur','ow','oi','ear','air','ure','er',
        'ay','ou','ie','ea','oy','ir','ue','aw','wh','ph','ew','oe','au','a_e','e_e','i_e','o_e','u_e'],
    b: ['-ment','-ness','-ful','-less','-ly','dis-','mis-','re-','sub-','inter-','super-','anti-',
        'there/their','here/hear','to/too','knight/night',"don't","can't","I'll","they're"],
    c: ['kn','wr','gn','mb','-cious','-tious','-able','-ible','ei after c','ough','augh','eigh']
  },
  // times tables: 2, 5, 10 first, then up to 12x12
  tables: { b: [2, 5, 10, 3, 4, 6, 8, 9, 7, 11, 12] },
  // fractions, decimals, percentages as equivalent triples
  fractions: { c: [
    { f: '1/2', d: 0.5, p: 50 }, { f: '1/4', d: 0.25, p: 25 }, { f: '3/4', d: 0.75, p: 75 },
    { f: '1/10', d: 0.1, p: 10 }, { f: '1/5', d: 0.2, p: 20 }, { f: '2/5', d: 0.4, p: 40 },
    { f: '3/5', d: 0.6, p: 60 }, { f: '4/5', d: 0.8, p: 80 }, { f: '1/8', d: 0.125, p: 12.5 },
    { f: '3/10', d: 0.3, p: 30 }, { f: '7/10', d: 0.7, p: 70 }, { f: '9/10', d: 0.9, p: 90 }
  ] },
  eras: [
    { id: 'stone',  th: 'ยุคหิน',     en: 'Stone Age',      from: -3000000, to: -3300 },
    { id: 'bronze', th: 'ยุคสำริด',   en: 'Bronze Age',     from: -3300,    to: -1200 },
    { id: 'iron',   th: 'ยุคเหล็ก',   en: 'Iron Age',       from: -1200,    to: -550 },
    { id: 'egypt',  th: 'อียิปต์โบราณ', en: 'Ancient Egypt',  from: -3100,    to: -30 },
    { id: 'greece', th: 'กรีกโบราณ',  en: 'Ancient Greece', from: -800,     to: -146 },
    { id: 'maya',   th: 'มายา',       en: 'Maya',           from: -2000,    to: 1500 }
  ],
  words: {
    a: ['cat','dog','sun','hat','pig','cup','bed','sit','hen','fox','map','red','bus','pin','log','net'],
    b: ['ship','chip','thin','rain','feet','boat','moon','farm','corn','park','night','sheep','train','green'],
    c: ['station','mountain','adventure','question','weight','knight','castle','island','journey','through','measure']
  }
};
