// ============================================================
// odeme-baslat  —  iyzico ödemesini başlatır (GÜNCEL CANLI HESAP)
// ============================================================

const Iyzipay = require('iyzipay');

const iyzipay = new Iyzipay({
  apiKey: process.env.IYZICO_API_KEY,
  secretKey: process.env.IYZICO_SECRET_KEY,
  uri: 'https://api.iyzico.com' // Canlı (Gerçek) iyzico API adresi tanımlandı
});

const SITE_URL = process.env.SITE_URL || 'https://kurabiyes.com';

exports.handler = async (event) => {
  // CORS engellerini aşmak için gerekli başlıklar
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Yöntem desteklenmiyor' }) };
  }

  let order;
  try {
    order = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Geçersiz istek' }) };
  }

  const { musteri, sepet, toplam } = order;
  if (!musteri || !sepet || !sepet.length || !toplam) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Eksik sipariş bilgisi.' }) };
  }

  // İnsan tarafından okunabilir kısa sipariş numarası
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const siparisNo = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

  const basketItems = sepet.map((item, i) => ({
    id: String(item.urunKodu || 'urun-' + i),
    name: item.ad || 'Kurabiye',
    category1: 'Kurabiye',
    itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,
    price: (Number(item.birimFiyat) * Number(item.adet)).toFixed(2)
  }));

  const adParcalari = (musteri.adSoyad || 'Musteri').trim().split(' ');
  const ad = adParcalari[0] || 'Musteri';
  const soyad = adParcalari.slice(1).join(' ') || '-';

  const request = {
    locale: Iyzipay.LOCALE.TR,
    conversationId: siparisNo,
    price: Number(toplam).toFixed(2),
    paidPrice: Number(toplam).toFixed(2),
    currency: Iyzipay.CURRENCY.TL, // TRY yerine TL olarak güncellendi
    basketId: siparisNo,
    paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
    callbackUrl: SITE_URL + '/.netlify/functions/odeme-sonuc',
    enabledInstallments: [1, 2, 3, 6],
    buyer: {
      id: 'BY-' + Date.now(),
      name: ad,
      surname: soyad,
      gsmNumber: musteri.telefon || '+905555555555',
      email: musteri.eposta || 'customer@kurabiyes.com',
      identityNumber: '11111111111',
      registrationAddress: musteri.adres || 'Eskisehir',
      ip: (event.headers['x-forwarded-for'] || '85.34.78.112').split(',')[0].trim(),
      city: 'Eskisehir',
      country: 'Turkey'
    },
    shippingAddress: {
      contactName: musteri.adSoyad || 'Musteri',
      city: 'Eskisehir', country: 'Turkey', address: musteri.adres || 'Eskisehir'
    },
    billingAddress: {
      contactName: musteri.adSoyad || 'Musteri',
      city: 'Eskisehir', country: 'Turkey', address: musteri.adres || 'Eskisehir'
    },
    basketItems
  };

  try {
    const result = await new Promise((resolve, reject) => {
      iyzipay.checkoutFormInitialize.create(request, (err, res) => (err ? reject(err) : resolve(res)));
    });

    if (result.status !== 'success') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: result.errorMessage || 'Ödeme başlatılamadı.' }) };
    }

    // Siparişi "ödeme bekleniyor" olarak kutuya düşür
    const urunMetni = sepet.map(s => `${s.ad} x${s.adet} (${(s.birimFiyat * s.adet).toLocaleString('tr-TR')} TL)`).join(' | ');
    await siparisKaydet(SITE_URL, {
      siparisNo,
      durum: 'ÖDEME BEKLENİYOR',
      ad: musteri.adSoyad || '',
      telefon: musteri.telefon || '',
      eposta: musteri.eposta || '',
      adres: musteri.adres || '',
      urunler: urunMetni,
      toplam: Number(toplam).toLocaleString('tr-TR') + ' TL',
      tarih: d.toLocaleString('tr-TR')
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ paymentPageUrl: result.paymentPageUrl, siparisNo })
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Ödeme başlatılamadı.' }) };
  }
};

// Siparişi Netlify Forms üzerinden "siparisler" kutusuna yazar.
async function siparisKaydet(siteUrl, veri) {
  try {
    const govde = new URLSearchParams({ 'form-name': 'siparisler', ...veri }).toString();
    await fetch(siteUrl + '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: govde
    });
  } catch (e) {
    console.error('Sipariş kaydı yazılamadı:', e);
  }
}
