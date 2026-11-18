// ============================================================
// odeme-sonuc  —  iyzico ödeme sonucunu doğrular
// ============================================================
// iyzico, ödeme bittiğinde (başarılı ya da başarısız) bu adrese döner.
// Burada ödemenin gerçekten başarılı olup olmadığını iyzico'ya
// sorarak DOĞRULARIZ (müşterinin tarayıcısına güvenmeyiz). Başarılıysa
// siparişi "ÖDENDİ ✓" olarak kutuya düşürür, Basit Kargo'da gönderi açar
// ve müşteriyi teşekkür sayfasına yönlendiririz.
// ============================================================

const Iyzipay = require('iyzipay');
const querystring = require('querystring');
const { trTarih, urunMetni, siparisKaydet } = require('./lib/ortak');
const bekleyen = require('./lib/bekleyen');
const basitKargo = require('./lib/basitkargo');
const { siparisOnayiGonder } = require('./lib/eposta');

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
      const siparisNo = result.basketId || result.conversationId || '-';

      // Ödeme öncesi saklanan sipariş bilgisini al ve gönderi aç (hata ödemeyi/yönlendirmeyi bozmaz)
      let kargoNotu = '';
      let kayit = null;
      try {
        kayit = await bekleyen.oku(event, siparisNo);
        if (kayit && kayit.islendi) {
          kayit = null; // iyzico dönüşü tekrar geldi: gönderi zaten açılmıştı
          kargoNotu = '';
        } else if (kayit && basitKargo.aktif()) {
          const k = await basitKargo.gonderiOlustur(kayit);
          kargoNotu = k.not;
          await bekleyen.islendiIsaretle(event, siparisNo);
        } else if (kayit) {
          await bekleyen.islendiIsaretle(event, siparisNo);
        } else if (basitKargo.aktif()) {
          kargoNotu = 'KARGO: sipariş verisi bulunamadı — Basit Kargo panelinden elle girin';
        }
      } catch (e) {
        console.error('Gönderi adımı başarısız:', e);
        kargoNotu = 'KARGO: otomatik açılamadı — Basit Kargo panelinden elle girin';
      }

      // Ödeme doğrulandı — "ödendi" kaydını düş.
      const m = kayit && kayit.musteri;
      await siparisKaydet({
        siparisNo,
        durum: 'ÖDENDİ ✓',
        ad: m ? m.adSoyad : '(yukarıdaki ÖDEME BEKLENİYOR kaydına bakın)',
        telefon: m ? m.telefonHam : '',
        eposta: m ? m.eposta : '',
        il: m ? m.il : '',
        ilce: m ? m.ilce : '',
        adres: m ? m.adres : '',
        odemeYontemi: 'Kart (iyzico)',
        urunler: (kayit ? urunMetni(kayit.satirlar) + ' | ' : '') + 'iyzico ödeme no: ' + (result.paymentId || '-'),
        toplam: (Number(result.paidPrice).toLocaleString('tr-TR')) + ' TL',
        kargo: kargoNotu,
        tarih: trTarih()
      });
      // Müşteriye onay e-postası (iyzico dönüşü tekrar gelirse kayit null olur → ikinci e-posta gitmez)
      if (kayit) {
        await siparisOnayiGonder({ ...kayit, toplam: Number(result.paidPrice) || kayit.toplam, odeme: 'kart', ucret: 0 });
      }
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
