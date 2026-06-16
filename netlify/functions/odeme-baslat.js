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

  const { musteri, sepet, toplam } = order;
  if (!musteri || !sepet || !sepet.length || !toplam) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Eksik sipariş bilgisi.' }) };
  }

  // İnsan tarafından okunabilir kısa sipariş numarası
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const siparisNo = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

  const basketItems = sepet.map((item, i) => ({
    id: String(item.urunKodu || 'urun-' + i),
    name: item.ad,
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
    currency: Iyzipay.CURRENCY.TRY,
    basketId: siparisNo,
    paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
    callbackUrl: SITE_URL + '/.netlify/functions/odeme-sonuc',
    enabledInstallments: [1, 2, 3, 6],
    buyer: {
      id: 'BY-' + Date.now(),
      name: ad,
      surname: soyad,
      gsmNumber: musteri.telefon || '',
      email: musteri.eposta || 'musteri@kurabiyes.com',
      identityNumber: '11111111111',
      registrationAddress: musteri.adres || '-',
      ip: (event.headers['x-forwarded-for'] || '85.34.78.112').split(',')[0].trim(),
      city: 'Eskisehir',
      country: 'Turkey'
    },
    shippingAddress: {
      contactName: musteri.adSoyad || 'Musteri',
      city: 'Eskisehir', country: 'Turkey', address: musteri.adres || '-'
    },
    billingAddress: {
      contactName: musteri.adSoyad || 'Musteri',
      city: 'Eskisehir', country: 'Turkey', address: musteri.adres || '-'
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
    const urunMetni = sepet.map(s => `${s.ad} x${s.adet} (${(s.birimFiyat * s.adet).toLocaleString('tr-TR')} TL)`).join(' | ');
    await siparisKaydet({
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
      body: JSON.stringify({ paymentPageUrl: result.paymentPageUrl, siparisNo })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Ödeme başlatılamadı.' }) };
  }
};

// Siparişi Netlify Forms üzerinden "siparisler" kutusuna yazar.
async function siparisKaydet(veri) {
  try {
    const govde = new URLSearchParams({ 'form-name': 'siparisler', ...veri }).toString();
    await fetch(SITE_URL + '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: govde
    });
  } catch (e) {
    // Kayıt başarısız olsa bile ödeme akışını bozma
    console.error('Sipariş kaydı yazılamadı:', e);
  }
}
