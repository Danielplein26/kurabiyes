// ============================================================
// Ortak yardımcılar — fiyatlar, kampanya, doğrulama, sipariş kaydı
// ============================================================
// odeme-baslat.js, siparis-olustur.js ve odeme-sonuc.js bu dosyayı kullanır.
// Fiyat/kampanya/kapıda ödeme ücreti SADECE burada tutulur; index.html'deki
// aynı değerler (PRODUCTS fiyatları, KAMPANYA, KAPIDA_ODEME) bununla BİREBİR
// aynı olmalıdır. Müşterinin tarayıcısından gelen fiyatlara asla güvenilmez.
// ============================================================

const SITE_URL = process.env.SITE_URL || 'https://kurabiyes.com';

// Ürün kataloğu. fiyat: güncel liste fiyatı (TL).
// agirlikKg ve olcu (cm: yukseklik, genislik, derinlik): Basit Kargo gönderisindeki
// paket bilgisidir. Ölçüler (cm) Ümit'in verdiği koli ölçüleridir; ağırlıklar tahminidir.
// Gönderi, Basit Kargo'da önce TASLAK açıldığı için yanlış ölçü bir şey ödetmez;
// ama otomatik barkod modunu (BASITKARGO_HANDLER) açmadan önce mutlaka düzelt.
const URUNLER = {
  'p5':                     { ad: "Leblebi Kurabiyesi 5'li Paket",      fiyat: 550,  agirlikKg: 1.0, olcu: [13, 25, 23] },
  'p10':                    { ad: "Leblebi Kurabiyesi 10'lu Paket",     fiyat: 990,  agirlikKg: 2.0, olcu: [26, 25, 23] },
  'p36':                    { ad: "Leblebi Kurabiyesi 36'lı Koli",      fiyat: 2345, agirlikKg: 7.2, olcu: [44, 22, 33] },
  'kestane-kavanoz-500':    { ad: 'Kestane Şekeri Kavanoz 500 gr',      fiyat: 500,  agirlikKg: 0.9, olcu: [13, 25, 23] },
  'kestane-cikolatali-240': { ad: 'Çikolatalı Kestane Şekeri 240 gr',   fiyat: 170,  agirlikKg: 0.3, olcu: [13, 25, 23] },
  'kestane-cikolatali-4lu': { ad: "4'lü Çikolatalı Kestane Paketi",     fiyat: 374,  agirlikKg: 0.6, olcu: [13, 25, 23] },
  'mh-fistik':              { ad: 'Antep Fıstıklı Met Helvası 400 gr',  fiyat: 255,  agirlikKg: 0.5, olcu: [13, 25, 23] },
  'mh-sade':                { ad: 'Sade Met Helvası 400 gr',            fiyat: 213,  agirlikKg: 0.5, olcu: [13, 25, 23] },
  'mh-karisik':             { ad: 'Karışık Met Helvası 400 gr',         fiyat: 213,  agirlikKg: 0.5, olcu: [13, 25, 23] },
  'mh-hediyelik':           { ad: 'Hediyelik Met Helvası 300 gr',       fiyat: 213,  agirlikKg: 0.4, olcu: [13, 25, 23] },
  'uclu-paket':             { ad: 'Üçlü Paket (Helva + Kurabiye + Kestane)', fiyat: 795, agirlikKg: 1.8, olcu: [13, 25, 23] }
};

// Eski kod "FIYAT_LISTESI" adıyla kullanıyordu; aynı veriyi sağlar.
const FIYAT_LISTESI = Object.fromEntries(Object.entries(URUNLER).map(([k, v]) => [k, v.fiyat]));

// SEPETTE İNDİRİM KAMPANYASI (11–12 Kasım 2026, Türkiye saati) — SONA ERDİ.
// Bitişte 10 dk tolerans: son dakikada sepeti açan müşterinin gördüğünden
// farklı tutar çekilmesin. index.html içindeki KAMPANYA ile aynı olmalı.
const KAMPANYA = {
  baslangic: Date.parse('2026-11-11T00:00:00+03:00'),
  bitis: Date.parse('2026-11-13T00:00:00+03:00') + 10 * 60 * 1000,
  fiyat: { 'p5': 487, 'p10': 877, 'p36': 2080 }
};
function gecerliFiyat(urunKodu) {
  const t = Date.now();
  if (t >= KAMPANYA.baslangic && t < KAMPANYA.bitis && KAMPANYA.fiyat[urunKodu]) {
    return KAMPANYA.fiyat[urunKodu];
  }
  return FIYAT_LISTESI[urunKodu];
}

// KAPIDA ÖDEME
// aktif: false yaparsan sunucu kapıda ödeme siparişlerini reddeder.
// ucret: kargo firmasının tahsilat (kapıda ödeme) bedelini müşteriye yansıtmak
// için TL cinsinden tutar. 0 = ücret alınmaz. index.html'deki KAPIDA_ODEME ile aynı olmalı.
const KAPIDA_ODEME = { aktif: true, ucret: 50 };

// Türkiye saatiyle tarih/saat (Netlify sunucuları UTC çalışır)
function trTarih(d) {
  return (d || new Date()).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
}
function siparisNoUret(onEk) {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date()).reduce((a, x) => (a[x.type] = x.value, a), {});
  return `${onEk || ''}${p.year}${p.month}${p.day}-${p.hour}${p.minute}${p.second}`;
}

// Telefon numarasını +90 formatına çevirir; geçersizse null.
function gsmFormatla(tel) {
  if (!tel) return null;
  let s = String(tel).replace(/\D/g, '');
  if (s.startsWith('90')) s = s.slice(2);
  if (s.startsWith('0')) s = s.slice(1);
  if (s.length !== 10) return null;
  return '+90' + s;
}

// Müşteri bilgilerini doğrular. Hata varsa { hata } döner, tamamsa { musteri } döner.
function musteriDogrula(m) {
  m = m || {};
  const adSoyad = String(m.adSoyad || '').trim();
  const telefonHam = String(m.telefon || '').trim();
  const eposta = String(m.eposta || '').trim();
  const il = String(m.il || '').trim();
  const ilce = String(m.ilce || '').trim();
  const adres = String(m.adres || '').trim();
  if (!adSoyad || !telefonHam || !eposta || !il || !ilce || !adres) {
    return { hata: 'Ad soyad, telefon, e-posta, il, ilçe ve adres bilgilerinin tamamı gereklidir.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta)) return { hata: 'E-posta adresi geçersiz görünüyor.' };
  const gsm = gsmFormatla(telefonHam);
  if (!gsm) return { hata: 'Telefon numarası geçersiz görünüyor. Lütfen 05xx xxx xx xx formatında girin.' };
  if (adSoyad.length > 120 || adres.length > 600 || ilce.length > 80) return { hata: 'Girilen bilgiler çok uzun.' };
  return { musteri: { adSoyad, telefonHam, gsm, eposta, il, ilce, adres } };
}

// Sepeti doğrular; sunucudaki gerçek fiyatlarla satırları ve toplamı hesaplar.
// Dönen: { hata } ya da { satirlar: [{urunKodu, ad, adet, birim, tutar}], urunToplam }
function sepetHesapla(sepet) {
  if (!Array.isArray(sepet) || !sepet.length) return { hata: 'Sepet boş.' };
  if (sepet.length > 30) return { hata: 'Geçersiz sepet.' };
  const satirlar = [];
  for (const item of sepet) {
    if (!item || !Object.prototype.hasOwnProperty.call(URUNLER, item.urunKodu)) {
      return { hata: 'Geçersiz ürün: ' + (item && item.urunKodu) };
    }
    const adet = Number(item.adet);
    if (!Number.isInteger(adet) || adet < 1 || adet > 999) return { hata: 'Geçersiz adet.' };
    const birim = gecerliFiyat(item.urunKodu);
    satirlar.push({ urunKodu: item.urunKodu, ad: URUNLER[item.urunKodu].ad, adet, birim, tutar: birim * adet });
  }
  return { satirlar, urunToplam: satirlar.reduce((t, s) => t + s.tutar, 0) };
}

function urunMetni(satirlar) {
  return satirlar.map(s => `${s.ad} x${s.adet} (${s.tutar.toLocaleString('tr-TR')} TL)`).join(' | ');
}

// Siparişi Netlify Forms üzerinden "siparisler" kutusuna yazar (e-posta bildirimi gelir).
// Hata olursa siparişi bozmaz, sadece loglar.
async function siparisKaydet(veri) {
  try {
    const govde = new URLSearchParams({ 'form-name': 'siparisler', ...veri }).toString();
    await fetch(SITE_URL + '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: govde
    });
  } catch (e) {
    console.error('Sipariş kaydı yazılamadı:', e);
  }
}

module.exports = {
  SITE_URL, URUNLER, FIYAT_LISTESI, KAMPANYA, KAPIDA_ODEME, gecerliFiyat,
  trTarih, siparisNoUret, gsmFormatla, musteriDogrula, sepetHesapla, urunMetni, siparisKaydet
};
