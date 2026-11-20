// ============================================================
// Müşteriye sipariş onay e-postası (Resend API — ek paket gerektirmez)
// ============================================================
// Netlify > Site configuration > Environment variables:
//   RESEND_API_KEY   : Resend'den alınan API anahtarı (yoksa e-posta gönderilmez, sipariş etkilenmez)
//   EPOSTA_GONDEREN  : (isteğe bağlı) varsayılan "Kurabiye's <siparis@kurabiyes.com>"
//   EPOSTA_KOPYA     : (isteğe bağlı) her onayın gizli kopyasının gideceği adres
// Gönderim hatası siparişi ASLA bozmaz; sadece loglanır.
// ============================================================

const GONDEREN = process.env.EPOSTA_GONDEREN || "Kurabiye's <siparis@kurabiyes.com>";
const YANIT_ADRESI = 'siparis@kurabiyes.com';
const WHATSAPP = 'https://wa.me/905427262985';
const HAVALE_BILGI = {
  banka: 'Enpara (QNB Finansbank)',
  hesapSahibi: 'Ümit Yıldırım',
  iban: 'TR38 0015 7000 0000 0109 3173 67'
};

const tl = n => Number(n).toLocaleString('tr-TR') + ' TL';
const kacis = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ODEME_ADI = { kart: 'Kredi / Banka Kartı', kapida: 'Kapıda Ödeme', havale: 'Havale / EFT' };

function icerikOlustur({ siparisNo, musteri, satirlar, toplam, odeme, ucret }) {
  const ad = (musteri.adSoyad || '').split(' ')[0];
  const satirHtml = satirlar.map(s => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0e6d8">${kacis(s.ad)} <span style="color:#8a7a66">× ${s.adet}</span></td>
        <td style="padding:8px 0;border-bottom:1px solid #f0e6d8;text-align:right;white-space:nowrap">${tl(s.tutar)}</td>
      </tr>`).join('');
  const ucretHtml = ucret ? `
      <tr><td style="padding:8px 0;border-bottom:1px solid #f0e6d8">Kapıda ödeme hizmet bedeli</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0e6d8;text-align:right">${tl(ucret)}</td></tr>` : '';

  let durumMetni, ekBlok = '';
  if (odeme === 'kart') {
    durumMetni = 'Ödemeniz başarıyla alındı. Siparişiniz hazırlanıyor ve <strong>1–3 iş günü</strong> içinde kargoya verilecek.';
  } else if (odeme === 'kapida') {
    durumMetni = `Siparişiniz hazırlanıyor ve <strong>1–3 iş günü</strong> içinde kargoya verilecek. Ödemeyi (<strong>${tl(toplam)}</strong>) teslimatta kargo görevlisine yapacaksınız.`;
  } else {
    durumMetni = 'Siparişiniz oluşturuldu. Ödemeniz hesabımıza geçtiğinde siparişiniz hazırlanıp <strong>1–3 iş günü</strong> içinde kargoya verilecek.';
    ekBlok = `
    <div style="background:#fff8ec;border:1px solid #f0d9b0;border-radius:10px;padding:16px;margin:20px 0">
      <div style="font-weight:bold;margin-bottom:8px">🏦 Havale / EFT bilgileri</div>
      <div>Banka: ${kacis(HAVALE_BILGI.banka)}</div>
      <div>Alıcı: ${kacis(HAVALE_BILGI.hesapSahibi)}</div>
      <div>IBAN: <strong style="letter-spacing:.5px">${kacis(HAVALE_BILGI.iban)}</strong></div>
      <div>Tutar: <strong>${tl(toplam)}</strong></div>
      <div style="margin-top:8px">Açıklama kısmına lütfen sipariş numaranızı yazın: <strong>${kacis(siparisNo)}</strong></div>
    </div>`;
  }

  const html = `<!DOCTYPE html><html lang="tr"><body style="margin:0;background:#f7f1e8;font-family:Arial,Helvetica,sans-serif;color:#3b2a1a">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
   <div style="background:#fff;border-radius:14px;padding:28px 24px">
    <div style="font-size:22px;font-weight:bold;color:#8b4a1c">Kurabiye's</div>
    <div style="font-size:12px;color:#8a7a66;margin-bottom:20px">1986'dan beri Eskişehir lezzeti</div>
    <h1 style="font-size:20px;margin:0 0 12px">Siparişiniz alındı, teşekkürler${ad ? ' ' + kacis(ad) : ''}! 🍪</h1>
    <p style="line-height:1.55;margin:0 0 6px">${durumMetni}</p>
    <p style="margin:12px 0 0;color:#8a7a66">Sipariş no: <strong style="color:#3b2a1a">${kacis(siparisNo)}</strong> · Ödeme: ${ODEME_ADI[odeme] || kacis(odeme)}</p>
    ${ekBlok}
    <table style="width:100%;border-collapse:collapse;margin-top:20px;font-size:14px">${satirHtml}${ucretHtml}
      <tr><td style="padding:10px 0;font-weight:bold">Toplam (kargo ücretsiz)</td>
      <td style="padding:10px 0;text-align:right;font-weight:bold;font-size:16px">${tl(toplam)}</td></tr>
    </table>
    <div style="margin-top:20px;font-size:14px;line-height:1.5">
      <div style="font-weight:bold;margin-bottom:4px">Teslimat adresi</div>
      <div>${kacis(musteri.adSoyad)} · ${kacis(musteri.telefonHam)}</div>
      <div>${kacis(musteri.adres)}</div>
      <div>${kacis(musteri.ilce)} / ${kacis(musteri.il)}</div>
    </div>
    ${musteri.not ? `<div style="margin-top:16px;font-size:14px;line-height:1.5;background:#f7f1e8;border-radius:10px;padding:12px 14px">
      <div style="font-weight:bold;margin-bottom:4px">Sipariş / hediye notunuz</div>
      <div style="white-space:pre-wrap">${kacis(musteri.not)}</div>
    </div>` : ''}
    <p style="margin:24px 0 0;font-size:14px;line-height:1.5">Kargo takibi ya da herhangi bir sorunuz olursa bu e-postayı yanıtlayabilir ya da
      <a href="${WHATSAPP}" style="color:#8b4a1c;font-weight:bold">WhatsApp'tan yazabilirsiniz</a>.</p>
   </div>
   <p style="text-align:center;font-size:12px;color:#8a7a66;margin-top:14px">Kurabiye's · Odunpazarı, Eskişehir · <a href="https://kurabiyes.com" style="color:#8a7a66">kurabiyes.com</a></p>
  </div></body></html>`;

  const text = [
    `Siparişiniz alındı, teşekkürler${ad ? ' ' + ad : ''}!`,
    `Sipariş no: ${siparisNo} · Ödeme: ${ODEME_ADI[odeme] || odeme}`,
    '',
    ...satirlar.map(s => `- ${s.ad} x${s.adet}: ${tl(s.tutar)}`),
    ucret ? `- Kapıda ödeme hizmet bedeli: ${tl(ucret)}` : null,
    `Toplam: ${tl(toplam)}`,
    '',
    odeme === 'havale'
      ? `Havale bilgileri: ${HAVALE_BILGI.banka} · ${HAVALE_BILGI.hesapSahibi} · IBAN ${HAVALE_BILGI.iban} · Açıklama: ${siparisNo}`
      : 'Siparişiniz 1–3 iş günü içinde kargoya verilecek.',
    '',
    `Teslimat: ${musteri.adSoyad}, ${musteri.adres}, ${musteri.ilce}/${musteri.il}`,
    musteri.not ? `Notunuz: ${musteri.not}` : null,
    `Sorularınız için: ${WHATSAPP}`
  ].filter(x => x !== null).join('\n');

  return { html, text, konu: `Siparişiniz alındı – ${siparisNo} | Kurabiye's` };
}

async function siparisOnayiGonder(siparis) {
  const anahtar = process.env.RESEND_API_KEY;
  if (!anahtar) { console.log('RESEND_API_KEY yok: onay e-postası atlandı'); return false; }
  if (!siparis || !siparis.musteri || !siparis.musteri.eposta) return false;
  try {
    const { html, text, konu } = icerikOlustur(siparis);
    const govde = { from: GONDEREN, to: [siparis.musteri.eposta], reply_to: YANIT_ADRESI, subject: konu, html, text };
    if (process.env.EPOSTA_KOPYA) govde.bcc = [process.env.EPOSTA_KOPYA];
    const ctrl = new AbortController();
    const zaman = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + anahtar, 'Content-Type': 'application/json' },
      body: JSON.stringify(govde),
      signal: ctrl.signal
    });
    clearTimeout(zaman);
    if (!r.ok) { console.error('Onay e-postası gönderilemedi:', r.status, await r.text()); return false; }
    return true;
  } catch (e) {
    console.error('Onay e-postası hatası:', e);
    return false;
  }
}

module.exports = { siparisOnayiGonder, icerikOlustur };
