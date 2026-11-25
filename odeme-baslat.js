// ============================================================
// odeme-baslat  —  iyzico ödemesini başlatır
// ============================================================
// Müşteri "iyzico ile Güvenli Ödeme Yap" deyince site bu fonksiyonu
// çağırır. Fonksiyon iyzico'da bir ödeme oturumu açar, müşteriyi
// yönlendireceği güvenli ödeme sayfasının adresini geri döner.
// Ayrıca siparişi "ÖDEME BEKLENİYOR" olarak sipariş kutunuza düşürür,
// böylece ödeme tamamlanmasa bile müşteriye ulaşabilirsiniz.
// ============================================================
 
const Iyzipay = require('iyzipay');

const iyzipay = new Iyzipay({
  apiKey: process.env.IYZICO_API_KEY,
  secretKey: process.env.IYZICO_SECRET_KEY,
  uri: process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com'
});

const SITE_URL = process.env.SITE_URL || 'https://kurabiyes.com';

// ============================================================
// Fiyat listesi — TEK doğru kaynak burasıdır (sunucu tarafı).
// Sepetten/istemciden gelen fiyatlara ASLA güvenilmez; her ürünün
// tutarı burada tanımlı gerçek fiyat üzerinden yeniden hesaplanır.
//
// ÖNEMLİ: Bu liste index.html içindeki EMBEDDED_SITE_DATA'daki ürün
// fiyatlarının BİREBİR AYNISI olmalıdır. Sitede fiyat/indirim
// değiştiğinde bu dosya güncellenmezse, müşteri sitede gördüğü
// fiyatı öder gibi görünür ama kartından burada yazan (eski) fiyat
// çekilir — bu liste 30 Eylül 2026'daki %15 indirimden sonraki
// güncel fiyatlarla eşitlendi.
// ============================================================
const FIYAT_LISTESI = {
  'p5': 638,
  'p10': 1148,
  'p36': 2720,
  'kestane-kavanoz-500': 638,
  'kestane-cikolatali-240': 170,
  'kestane-cikolatali-4lu': 374,
  'mh-fistik': 255,
  'mh-sade': 213,
  'mh-karisik': 213,
  'mh-hediyelik': 213,
  'uclu-paket': 935
};

// ============================================================
// SEPETTE İNDİRİM KAMPANYASI (11–12 Kasım 2026, Türkiye saati)
// Eski liste fiyatı üzerinden toplam %35 — sadece leblebi kurabiyesi.
// index.html içindeki KAMPANYA ile BİREBİR AYNI olmalıdır.
// Bitişte 10 dk tolerans: 23:59'da sepeti açıp formu dolduran
// müşteriden gördüğünden farklı tutar çekilmesin.
// ============================================================
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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Yöntem desteklenmiyor' }) };
  }

  let order;
  try {
    order = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Geçersiz istek' }) };
  }

  const { musteri, sepet } = order;
  if (!musteri || !sepet || !sepet.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Eksik sipariş bilgisi.' }) };
  }

  // ============================================================
  // Müşteri bilgilerini doğrula — hiçbir alan için sahte/varsayılan
  // değer KULLANILMAZ. Formda hepsi zaten "required", ama sunucu
  // tarafında da doğrulanır (ör. doğrudan API'ye atılan, forma
  // uğramamış istekler için). Eksik/geçersiz varsa sipariş reddedilir;
  // asla iyzico'ya uydurma bir şehir/telefon/eposta gönderilmez.
  // ============================================================
  const adSoyad = String(musteri.adSoyad || '').trim();
  const telefonHam = String(musteri.telefon || '').trim();
  const eposta = String(musteri.eposta || '').trim();
  const il = String(musteri.il || '').trim();
  const ilce = String(musteri.ilce || '').trim();
  const adres = String(musteri.adres || '').trim();

  if (!adSoyad || !telefonHam || !eposta || !il || !ilce || !adres) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Ad soyad, telefon, e-posta, il, ilçe ve adres bilgilerinin tamamı gereklidir.' }) };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'E-posta adresi geçersiz görünüyor.' }) };
  }
  const gsm = gsmFormatla(telefonHam);
  if (!gsm) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Telefon numarası geçersiz görünüyor. Lütfen 05xx xxx xx xx formatında girin.' }) };
  }

  // Sepetteki her kalemin gerçek birim fiyatını sunucudaki listeden al;
  // istemciden gelen birimFiyat/toplam değerleri tamamen yok sayılır.
  for (const item of sepet) {
    if (!Object.prototype.hasOwnProperty.call(FIYAT_LISTESI, item.urunKodu)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Geçersiz ürün: ' + item.urunKodu }) };
    }
    const adet = Number(item.adet);
    if (!Number.isInteger(adet) || adet < 1 || adet > 999) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Geçersiz adet.' }) };
    }
  }
  const guvenilirBirimFiyat = (item) => gecerliFiyat(item.urunKodu);
  const toplam = sepet.reduce((t, item) => t + guvenilirBirimFiyat(item) * Number(item.adet), 0);

  // İnsan tarafından okunabilir kısa sipariş numarası
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const siparisNo = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

  const basketItems = sepet.map((item, i) => ({
    id: String(item.urunKodu || 'urun-' + i),
    name: item.ad,
    category1: 'Kurabiye',
    itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,
    price: (guvenilirBirimFiyat(item) * Number(item.adet)).toFixed(2)
  }));

  const adParcalari = adSoyad.split(' ').filter(Boolean);
  const ad = adParcalari[0] || adSoyad;
  const soyad = adParcalari.slice(1).join(' ') || '-';

  // Müşterinin gerçek il/ilçe/adres bilgisi — yukarıda doğrulandı,
  // burada asla varsayılan/sahte bir değerle değiştirilmez.
  const tamAdres = [adres, ilce, il].join(', ');

  const request = {
    locale: Iyzipay.LOCALE.TR,
    conversationId: siparisNo,
    price: toplam.toFixed(2),
    paidPrice: toplam.toFixed(2),
    currency: Iyzipay.CURRENCY.TRY,
    basketId: siparisNo,
    paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
    callbackUrl: SITE_URL + '/.netlify/functions/odeme-sonuc',
    enabledInstallments: [1],
    buyer: {
      id: 'BY-' + Date.now(),
      name: ad,
      surname: soyad,
      gsmNumber: gsm,
      email: eposta,
      identityNumber: '74300864791', // TODO: bkz. not — geçici, gerçek müşteri TC no'su toplanmıyor
      registrationAddress: tamAdres,
      ip: (event.headers['x-forwarded-for'] || '85.34.78.112').split(',')[0].trim(),
      city: il,
      country: 'Turkey'
    },
    shippingAddress: {
      contactName: adSoyad,
      city: il, country: 'Turkey', address: tamAdres
    },
    billingAddress: {
      contactName: adSoyad,
      city: il, country: 'Turkey', address: tamAdres
    },
    basketItems
  };
 
  try {
    const result = await new Promise((resolve, reject) => {
      iyzipay.checkoutFormInitialize.create(request, (err, res) => (err ? reject(err) : resolve(res)));
    });
 
    if (result.status !== 'success') {
      return { statusCode: 400, body: JSON.stringify({ error: result.errorMessage || 'Ödeme başlatılamadı.' }) };
    }
 
    // Siparişi "ödeme bekleniyor" olarak kutuya düşür (ödeme bağlanmasa da
    // müşteriye ulaşabilmeniz için tüm iletişim bilgileriyle).
    const urunMetni = sepet.map(s => `${s.ad} x${s.adet} (${(guvenilirBirimFiyat(s) * s.adet).toLocaleString('tr-TR')} TL)`).join(' | ');
    await siparisKaydet({
      siparisNo,
      durum: 'ÖDEME BEKLENİYOR',
      ad: adSoyad,
      telefon: telefonHam,
      eposta: eposta,
      il: il,
      ilce: ilce,
      adres: adres,
      odemeYontemi: 'Kart (iyzico)',
      urunler: urunMetni,
      toplam: toplam.toLocaleString('tr-TR') + ' TL',
      tarih: d.toLocaleString('tr-TR')
    });
 
    return {
      statusCode: 200,
      body: JSON.stringify({ paymentPageUrl: result.paymentPageUrl, siparisNo })
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Ödeme başlatılamadı.',
        detay: (e && (e.message || e.errorMessage)) || String(e),
        tip: (e && e.name) || typeof e
      })
    };
  }
};
 
// Siparişi Netlify Forms üzerinden "siparisler" kutusuna yazar.
function siparisKaydet(veri) {
  return new Promise((resolve) => {
    try {
      const https = require('https');
      const govde = new URLSearchParams({ 'form-name': 'siparisler', ...veri }).toString();
      const u = new URL(SITE_URL);
      const req = https.request({
        hostname: u.hostname,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(govde)
        }
      }, (res) => {
        res.on('data', () => {});
        res.on('end', resolve);
      });
      req.on('error', (e) => { console.error('Sipariş kaydı yazılamadı:', e); resolve(); });
      req.write(govde);
      req.end();
    } catch (e) {
      console.error('Sipariş kaydı yazılamadı:', e);
      resolve();
    }
  });
}
 
// Telefon numarasını iyzico'nun beklediği +90 formatına çevirir.
// Geçersizse null döner (çağıran taraf siparişi reddeder) — asla
// sahte bir numarayla devam edilmez.
function gsmFormatla(tel) {
  if (!tel) return null;
  let s = String(tel).replace(/\D/g, ''); // sadece rakamlar
  if (s.startsWith('90')) s = s.slice(2);
  if (s.startsWith('0')) s = s.slice(1);
  if (s.length !== 10) return null;
  return '+90' + s;
}
