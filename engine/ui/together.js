// "Play together" panel: make a room (shows the code, a link and a QR for the other device) or type a
// code to join. A small chip at the top shows the room and whether the partner is here.
import { i18n } from '../core/i18n.js';

i18n.add({
  th: { tog: 'เล่นด้วยกัน', togMake: 'สร้างห้อง', togJoin: 'เข้าห้อง', togCode: 'รหัส 4 ตัว', togLeave: 'ออกจากห้อง', togCopy: 'คัดลอกลิงก์', togCopied: 'คัดลอกแล้ว',
        st_off: '', st_connecting: 'กำลังเชื่อมต่อ…', st_waiting: 'รอคนเข้าห้อง {code}', st_joining: 'กำลังเข้าห้อง {code}…', st_together: 'เล่นด้วยกันในห้อง {code}', st_nohost: 'ไม่พบเจ้าของห้อง {code}', st_fail: 'เชื่อมต่อไม่ได้',
        via_supabase: 'ผ่านอินเทอร์เน็ต เล่นจากที่ไหนก็ได้', via_wifi: 'ผ่าน Wi-Fi บ้าน อีกเครื่องต้องอยู่ Wi-Fi เดียวกัน', via_window: 'ทดลองในเครื่องนี้: เปิดลิงก์ในอีกหน้าต่าง', together_in: 'เข้ามาบนเกาะของเพื่อนแล้ว' },
  en: { tog: 'Play together', togMake: 'Make a room', togJoin: 'Join', togCode: '4-letter code', togLeave: 'Leave room', togCopy: 'Copy link', togCopied: 'Copied',
        st_off: '', st_connecting: 'Connecting…', st_waiting: 'Waiting in room {code}', st_joining: 'Joining room {code}…', st_together: 'Playing together in {code}', st_nohost: 'No one is hosting {code}', st_fail: 'Could not connect',
        via_supabase: 'Over the internet. Play from anywhere.', via_wifi: 'Over home Wi-Fi. The other device must be on the same Wi-Fi.', via_window: 'Try-out on this device: open the link in another window.', together_in: 'You are on your partner\'s island' }
});
const $ = id => document.getElementById(id);

export function mountTogether(game){
  const net = game.net, box = $('togBox'), chip = $('togChip');
  const show = () => {
    const s = net.status, on = net.on; $('togIdle').hidden = on; $('togRoom').hidden = !on;
    $('togState').textContent = i18n.t('st_' + s, { code: net.code }); $('togVia').textContent = on ? i18n.t('via_' + net.via) : '';
    $('togCodeBig').textContent = net.code; chip.hidden = !on; chip.className = 'hud clay ' + (s === 'together' ? 'on' : 'wait');
    $('togChipTxt').textContent = s === 'together' ? [...net.remotes.values()].map(r => r.s && r.s.nm).filter(Boolean).join(', ') || net.code : net.code;
    if (on && net.host) qr(net.joinUrl()); else $('togQr').innerHTML = '';
  };
  net.onStatus(show); i18n.onChange(show);
  $('togMake').onclick = async () => { await net.make(); show(); };
  $('togJoinBtn').onclick = async () => { const c = $('togInput').value.trim(); if (c.length === 4){ await net.join(c); show(); } };
  $('togInput').oninput = e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); };
  $('togLeaveBtn').onclick = () => { net.leave(); show(); };
  $('togCopyBtn').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(net.joinUrl()).then(() => { $('togCopyBtn').textContent = i18n.t('togCopied'); setTimeout(() => $('togCopyBtn').textContent = i18n.t('togCopy'), 1500); }); };
  chip.onclick = () => $('set').classList.add('on');
  setInterval(() => { if (net.status === 'together') show(); }, 2000);
  show();
}

let qrFor = '';
async function qr(url){
  if (url === qrFor) return; qrFor = url; const el = $('togQr');
  if (!window.qrcode){ try{ await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }catch(e){ return; } }
  try{ const q = window.qrcode(0, 'M'); q.addData(url); q.make(); el.innerHTML = ''; const im = new Image(); im.src = q.createDataURL(5, 2); im.alt = 'QR'; el.appendChild(im); }catch(e){}
}
