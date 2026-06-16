// ============================================================
// odeme-sonuc  —  iyzico ödeme sonucunu doğrular
// ============================================================
// iyzico, ödeme bittiğinde (başarılı ya da başarısız) bu adrese döner.
// Burada ödemenin gerçekten başarılı olup olmadığını iyzico'ya
// sorarak DOĞRULARIZ (müşterinin tarayıcısına güvenmeyiz). Başarılıysa
// siparişi "ÖDENDİ ✓" olarak kutuya düşürür ve müşteriyi teşekkür
// sayfasına yönlendiririz.
// ============================================================

const Iyzipay = require('iyzipay');
const querystring = require('querystring');

const iyzipay = new Iyzipay({
  apiKey: process.env.IYZICO_API_KEY,
  secretKey: process.env.IYZICO_SECRET_KEY,
  uri: process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com'
});

const SITE_URL = process.env.SITE_URL || 'https://kurabiyes.com';

exports.handler = async (event) => {
  let token = null;
  try {
    const govde = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;
    token = querystring.parse(govde).token;
  } catch {
    token = null;
  }

  if (!token) return yonlendir('/odeme-basarisiz.html');

  try {
    const result = await new Promise((resolve, reject) => {
      iyzipay.checkoutForm.retrieve({ locale: Iyzipay.LOCALE.TR, token }, (err, res) => (err ? reject(err) : resolve(res)));
    });

    if (result.status === 'success' && result.paymentStatus === 'SUCCESS') {
      // Ödeme doğrulandı — "ödendi" kaydını düş.
      await siparisKaydet({
        siparisNo: result.basketId || result.conversationId || '-',
        durum: 'ÖDENDİ ✓',
        ad: '(yukarıdaki ÖDEME BEKLENİYOR kaydına bakın)',
        telefon: '',
        eposta: '',
        adres: '',
        urunler: 'iyzico ödeme no: ' + (result.paymentId || '-'),
        toplam: (Number(result.paidPrice).toLocaleString('tr-TR')) + ' TL',
        tarih: new Date().toLocaleString('tr-TR')
      });
      return yonlendir('/odeme-basarili.html');
    }

    return yonlendir('/odeme-basarisiz.html');
  } catch (e) {
    return yonlendir('/odeme-basarisiz.html');
  }
};

function yonlendir(yol) {
  return { statusCode: 303, headers: { Location: SITE_URL + yol }, body: '' };
}

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
