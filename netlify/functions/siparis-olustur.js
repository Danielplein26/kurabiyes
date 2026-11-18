// ============================================================
// siparis-olustur  —  Kapıda ödeme ve Havale/EFT siparişlerini alır
// ============================================================
// Kart ödemesi odeme-baslat.js ile yapılır. Bu fonksiyon, ödemesi
// iyzico dışında olan iki yöntemi karşılar:
//   yontem: 'kapida'  → ödeme teslimatta kargo görevlisine yapılır
//   yontem: 'havale'  → müşteri IBAN'a havale/EFT yapar
// Fiyatlar sunucuda yeniden hesaplanır (tarayıcıdan gelen tutara güvenilmez).
// Sipariş "siparisler" kutusuna düşer ve Basit Kargo'da gönderi (taslak) açılır.
// ============================================================

const { KAPIDA_ODEME, musteriDogrula, sepetHesapla, urunMetni, siparisNoUret, trTarih, siparisKaydet } = require('./lib/ortak');
const { siparisOnayiGonder } = require('./lib/eposta');
const basitKargo = require('./lib/basitkargo');

const json = (statusCode, obj) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Yöntem desteklenmiyor' });

  let istek;
  try { istek = JSON.parse(event.body); } catch { return json(400, { error: 'Geçersiz istek' }); }

  // Bot tuzağı: gizli alan doluysa sessizce başarılı gibi davran, hiçbir şey kaydetme
  if (istek['bot-field']) return json(200, { siparisNo: 'X', toplam: 0 });

  const yontem = istek.yontem;
  if (yontem !== 'kapida' && yontem !== 'havale') return json(400, { error: 'Geçersiz ödeme yöntemi.' });
  if (yontem === 'kapida' && !KAPIDA_ODEME.aktif) return json(403, { error: 'Kapıda ödeme şu anda kullanılamıyor.' });

  const dogru = musteriDogrula(istek.musteri);
  if (dogru.hata) return json(400, { error: dogru.hata });
  const musteri = dogru.musteri;

  const hesap = sepetHesapla(istek.sepet);
  if (hesap.hata) return json(400, { error: hesap.hata });

  const ucret = yontem === 'kapida' ? KAPIDA_ODEME.ucret : 0;
  const toplam = hesap.urunToplam + ucret;
  const siparisNo = siparisNoUret(yontem === 'kapida' ? 'K' : 'H');

  const kargo = await basitKargo.gonderiOlustur({
    siparisNo, musteri, satirlar: hesap.satirlar, toplam, odeme: yontem
  });

  await siparisKaydet({
    siparisNo,
    durum: yontem === 'kapida' ? 'KAPIDA ÖDEME - SİPARİŞ ALINDI' : 'HAVALE - ÖDEME BEKLENİYOR',
    ad: musteri.adSoyad,
    telefon: musteri.telefonHam,
    eposta: musteri.eposta,
    il: musteri.il,
    ilce: musteri.ilce,
    adres: musteri.adres,
    odemeYontemi: yontem === 'kapida' ? 'Kapıda Ödeme' : 'Havale/EFT',
    urunler: urunMetni(hesap.satirlar) + (ucret ? ` | Kapıda ödeme ücreti: ${ucret} TL` : ''),
    toplam: toplam.toLocaleString('tr-TR') + ' TL',
    kargo: kargo.durum === 'ATLANDI' ? '' : kargo.not,
    tarih: trTarih()
  });

  await siparisOnayiGonder({ siparisNo, musteri, satirlar: hesap.satirlar, toplam, odeme: yontem, ucret });

  return json(200, { siparisNo, toplam, ucret });
};
