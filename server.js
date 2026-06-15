// ============================================================
// ÖRNEK SUNUCU — iyzico Checkout Form Entegrasyonu
// ============================================================
// Bu dosya, index.html'deki "Sepete Ekle / Ödemeye Geç" akışını
// gerçek bir iyzico ödemesine bağlamak için BAŞLANGIÇ ÖRNEĞİDİR.
//
// Kurulum:
//   1) Bu klasörde:  npm init -y && npm install express iyzipay cors dotenv
//   2) .env.example dosyasını .env olarak kopyalayıp iyzico
//      panelinizden aldığınız API KEY / SECRET KEY bilgilerini girin.
//   3) node server.js ile çalıştırın (varsayılan port: 3000)
//   4) index.html dosyasındaki fetch('/api/odeme/baslat') isteğinin
//      bu sunucuya ulaşacağı şekilde yayınlayın (aynı domain/proxy
//      ya da CORS ayarlı ayrı bir sunucu).
//
// ÖNEMLİ: API_KEY ve SECRET_KEY asla tarayıcı koduna (index.html,
// app.js vb.) yazılmamalıdır. Bu bilgiler yalnızca sunucuda,
// .env dosyasında saklanmalıdır.
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Iyzipay = require('iyzipay');

const app = express();
app.use(cors());
app.use(express.json());
// index.html ve images/ klasörünü de bu sunucudan servis etmek için:
app.use(express.static('..'));

const iyzipay = new Iyzipay({
  apiKey: process.env.IYZICO_API_KEY,
  secretKey: process.env.IYZICO_SECRET_KEY,
  // Test ortamı: 'https://sandbox-api.iyzipay.com'
  // Canlı (production) ortam: 'https://api.iyzipay.com'
  uri: process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com'
});

app.post('/api/odeme/baslat', (req, res) => {
  const { musteri, sepet, toplam } = req.body;

  if (!musteri || !sepet || !sepet.length || !toplam) {
    return res.status(400).json({ error: 'Eksik sipariş bilgisi.' });
  }

  const conversationId = 'siparis-' + Date.now();

  const basketItems = sepet.map((item, i) => ({
    id: item.urunKodu || ('urun-' + i),
    name: item.ad,
    category1: 'Kurabiye',
    itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,
    price: (item.birimFiyat * item.adet).toFixed(2)
  }));

  const request = {
    locale: Iyzipay.LOCALE.TR,
    conversationId: conversationId,
    price: toplam.toFixed(2),
    paidPrice: toplam.toFixed(2),
    currency: Iyzipay.CURRENCY.TRY,
    basketId: conversationId,
    paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,

    // Ödeme tamamlandığında iyzico'nun sonucu POST edeceği adres.
    // Bu adreste sonucu doğrulayıp kullanıcıyı "Sipariş Alındı"
    // sayfanıza yönlendirmeniz gerekir.
    callbackUrl: process.env.CALLBACK_URL || 'http://localhost:3000/api/odeme/sonuc',

    enabledInstallments: [1, 2, 3, 6, 9],

    buyer: {
      id: 'musteri-' + Date.now(),
      name: (musteri.adSoyad || '').split(' ')[0] || 'Müşteri',
      surname: (musteri.adSoyad || '').split(' ').slice(1).join(' ') || '-',
      gsmNumber: musteri.telefon,
      email: musteri.eposta,
      identityNumber: '11111111111', // Gerçek entegrasyonda T.C. kimlik no alınmalı
      registrationAddress: musteri.adres,
      ip: req.ip,
      city: 'Eskişehir',
      country: 'Turkey'
    },

    shippingAddress: {
      contactName: musteri.adSoyad,
      city: 'Eskişehir',
      country: 'Turkey',
      address: musteri.adres
    },

    billingAddress: {
      contactName: musteri.adSoyad,
      city: 'Eskişehir',
      country: 'Turkey',
      address: musteri.adres
    },

    basketItems: basketItems
  };

  iyzipay.checkoutFormInitialize.create(request, (err, result) => {
    if (err) {
      console.error('iyzico hata:', err);
      return res.status(500).json({ error: 'Ödeme başlatılamadı.' });
    }

    if (result.status !== 'success') {
      console.error('iyzico sonucu:', result);
      return res.status(400).json({ error: result.errorMessage || 'Ödeme başlatılamadı.' });
    }

    // index.html bu HTML içeriğini sayfaya yazarak
    // iyzico'nun gömülü ödeme formunu gösterir.
    res.json({
      checkoutFormContent: result.checkoutFormContent,
      token: result.token
    });
  });
});

// iyzico, ödeme sonucunu bu adrese POST eder (callbackUrl).
// Burada result.token ile checkoutForm.retrieve çağrısı yapılıp
// ödemenin başarılı olup olmadığı doğrulanmalı, ardından sipariş
// veritabanına kaydedilmeli ve kullanıcı bilgilendirilmelidir.
app.post('/api/odeme/sonuc', (req, res) => {
  const token = req.body.token;

  iyzipay.checkoutForm.retrieve({ locale: Iyzipay.LOCALE.TR, token }, (err, result) => {
    if (err || result.status !== 'success' || result.paymentStatus !== 'SUCCESS') {
      console.error('Ödeme doğrulama hatası:', err || result);
      return res.redirect('/odeme-basarisiz.html');
    }

    // TODO: result.basketId / conversationId üzerinden siparişi
    // veritabanınızda "ödendi" olarak işaretleyin.
    console.log('Ödeme başarılı:', result);
    res.redirect('/odeme-basarili.html');
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sunucu çalışıyor: http://localhost:${PORT}`));
