// ============================================================
// odeme-baslat  —  iyzico ödemesini başlatır
// ============================================================
// Müşteri "iyzico ile Güvenli Ödeme Yap" deyince site bu fonksiyonu
// çağırır. Fonksiyon iyzico'da bir ödeme oturumu açar, müşteriyi
// yönlendireceği güvenli ödeme sayfasının adresini geri döner.
// Ayrıca siparişi "ÖDEME BEKLENİYOR" olarak sipariş kutunuza düşürür,
// böylece ödeme tamamlanmasa bile müşteriye ulaşabilirsiniz.
// Sipariş bilgisi ayrıca saklanır; ödeme doğrulanınca (odeme-sonuc.js)
// Basit Kargo'da gönderi açılır.
//
// Fiyat listesi, kampanya ve doğrulama kuralları lib/ortak.js içindedir.
// ============================================================

const Iyzipay = require('iyzipay');
const {
  musteriDogrula, sepetHesapla, urunMetni, siparisNoUret, trTarih, siparisKaydet
} = require('./lib/ortak');
const bekleyen = require('./lib/bekleyen');

const iyzipay = new Iyzipay({
  apiKey: process.env.IYZICO_API_KEY,
  secretKey: process.env.IYZICO_SECRET_KEY,
  uri: process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com'
});

const SITE_URL = process.env.SITE_URL || 'https://kurabiyes.com';

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

  const { musteri: musteriHam, sepet } = order;
  if (!musteriHam || !sepet || !sepet.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Eksik sipariş bilgisi.' }) };
  }

  // Müşteri bilgilerini doğrula — hiçbir alan için sahte/varsayılan değer KULLANILMAZ.
  const dogru = musteriDogrula(musteriHam);
  if (dogru.hata) return { statusCode: 400, body: JSON.stringify({ error: dogru.hata }) };
  const musteri = dogru.musteri;
  const { adSoyad, telefonHam, gsm, eposta, il, ilce, adres } = musteri;

  // Sepetteki her kalemin gerçek birim fiyatını sunucudaki listeden al;
  // istemciden gelen birimFiyat/toplam değerleri tamamen yok sayılır.
  const hesap = sepetHesapla(sepet);
  if (hesap.hata) return { statusCode: 400, body: JSON.stringify({ error: hesap.hata }) };
  const { satirlar } = hesap;
  const toplam = hesap.urunToplam;

  const d = new Date();
  const siparisNo = siparisNoUret();

  const basketItems = satirlar.map((s) => ({
    id: String(s.urunKodu),
    name: s.ad,
    category1: 'Kurabiye',
    itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,
    price: s.tutar.toFixed(2)
  }));

  const adParcalari = adSoyad.split(' ').filter(Boolean);
  const ad = adParcalari[0] || adSoyad;
  const soyad = adParcalari.slice(1).join(' ') || '-';

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
    enabledInstallments: [1, 2, 3, 6],
    buyer: {
      id: 'BY-' + Date.now(),
      name: ad,
      surname: soyad,
      gsmNumber: gsm,
      email: eposta,
      identityNumber: '74300864791', // TODO: geçici, gerçek müşteri TC no'su toplanmıyor
      registrationAddress: tamAdres,
      ip: (event.headers['x-forwarded-for'] || '85.34.78.112').split(',')[0].trim(),
      city: il,
      country: 'Turkey'
    },
    shippingAddress: { contactName: adSoyad, city: il, country: 'Turkey', address: tamAdres },
    billingAddress: { contactName: adSoyad, city: il, country: 'Turkey', address: tamAdres },
    basketItems
  };

  try {
    const result = await new Promise((resolve, reject) => {
      iyzipay.checkoutFormInitialize.create(request, (err, res) => (err ? reject(err) : resolve(res)));
    });

    if (result.status !== 'success') {
      return { statusCode: 400, body: JSON.stringify({ error: result.errorMessage || 'Ödeme başlatılamadı.' }) };
    }

    // Ödeme bitince gönderi açabilmek için sipariş bilgisini sakla (başarısız olsa da ödeme devam eder)
    await bekleyen.kaydet(event, siparisNo, {
      siparisNo, musteri, satirlar, toplam, odeme: 'kart', olusturma: d.toISOString()
    });

    // Siparişi "ödeme bekleniyor" olarak kutuya düşür.
    await siparisKaydet({
      siparisNo,
      durum: 'ÖDEME BEKLENİYOR',
      ad: adSoyad,
      telefon: telefonHam,
      eposta,
      il,
      ilce,
      adres,
      odemeYontemi: 'Kart (iyzico)',
      urunler: urunMetni(satirlar),
      toplam: toplam.toLocaleString('tr-TR') + ' TL',
      tarih: trTarih(d)
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
