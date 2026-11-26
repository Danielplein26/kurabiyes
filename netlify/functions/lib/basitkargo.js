// ============================================================
// Basit Kargo entegrasyonu (https://basitkargo.com/api)
// ============================================================
// Ne yapar: Sipariş kesinleşince Basit Kargo panelinde gönderi oluşturur.
//   - Varsayılan: TASLAK sipariş (POST /v2/order, durum NEW). Ücret düşmez,
//     kargo kodu üretilmez. Panelde kargo firmasını seçip tek tıkla barkod alırsın.
//   - BASITKARGO_HANDLER tanımlıysa: sipariş + kargo kodu tek seferde
//     (POST /v2/order/barcode). Bakiyenden kargo ücreti düşer.
//     (ör. SURAT, YURTICI, ARAS, MNG, PTT, ECONOMIC=en ucuz, FAST=en hızlı,
//      kendi anlaşman için SELF_YURTICI gibi)
//
// Ortam değişkenleri (Netlify → Site configuration → Environment variables):
//   BASITKARGO_TOKEN         (zorunlu) Basit Kargo hesap ayarlarından oluşturulan API token.
//                            Tanımlı değilse entegrasyon sessizce devre dışı kalır; site çalışmaya devam eder.
//   BASITKARGO_HANDLER       (isteğiyle) otomatik barkod için kargo kodu. Boşsa sadece taslak açılır.
//   BASITKARGO_ADDRESS_ID    (isteğe bağlı) gönderici adres kimliği; yoksa panelde varsayılan adres kullanılır.
//   BASITKARGO_BRAND_ID      (isteğe bağlı) marka/mağaza profili kimliği; yoksa varsayılan profil.
//   (Kapıda tahsilat şekli artık müşterinin seçimine göre: nakit → CASH, kart → CREDIT_CARD)
//
// Basit Kargo hatası ASLA siparişi/ödemeyi bozmaz: hata yakalanır, loglanır ve
// sipariş kutusundaki kayda "KARGO: elle girin" notu düşer.
// ============================================================

const { URUNLER } = require('./ortak');

const BASE = (process.env.BASITKARGO_BASE || 'https://basitkargo.com/api').replace(/\/$/, '');

function aktif() {
  return !!process.env.BASITKARGO_TOKEN;
}

// "05xx xxx xx xx" / "+90 5xx..." → "5xxxxxxxxx" (Basit Kargo 10 hane bekliyor)
function telefon10(tel) {
  let s = String(tel || '').replace(/\D/g, '');
  if (s.startsWith('90') && s.length > 10) s = s.slice(2);
  if (s.startsWith('0')) s = s.slice(1);
  return s;
}

// Her adet ürün için bir paket (koli) tanımlar; ağırlık kg, ölçü cm.
function paketler(satirlar) {
  const liste = [];
  for (const s of satirlar) {
    const u = URUNLER[s.urunKodu];
    for (let i = 0; i < s.adet && liste.length < 30; i++) {
      liste.push({ height: u.olcu[0], width: u.olcu[1], depth: u.olcu[2], weight: u.agirlikKg });
    }
  }
  return liste;
}

/**
 * Gönderi oluşturur.
 * siparis: { siparisNo, musteri:{adSoyad,telefonHam,eposta,il,ilce,adres}, satirlar, toplam,
 *            odeme: 'kart' | 'havale' | 'kapida' }
 * Dönen: { durum: 'ATLANDI' | 'TASLAK' | 'BARKOD' | 'HATA', id?, barcode?, not }
 */
async function gonderiOlustur(siparis) {
  if (!aktif()) return { durum: 'ATLANDI', not: 'Basit Kargo bağlı değil (BASITKARGO_TOKEN tanımsız)' };

  const m = siparis.musteri;
  const govde = {
    type: 'OUTGOING',
    content: {
      name: siparis.satirlar.map(s => `${s.ad} x${s.adet}`).join(', ').slice(0, 200),
      code: siparis.siparisNo,
      items: siparis.satirlar.map(s => ({ name: s.ad, code: s.urunKodu, quantity: String(s.adet) })),
      packages: paketler(siparis.satirlar)
    },
    client: {
      name: m.adSoyad,
      phone: telefon10(m.telefonHam),
      ...(m.eposta ? { email: m.eposta } : {}),
      city: m.il,
      town: m.ilce,
      address: m.adres
    },
    orderTotal: siparis.toplam
  };
  if (siparis.odeme === 'kapida') {
    govde.orderPaymentType = 'COLLECT_ON_DELIVERY';
    govde.collect = siparis.toplam;
    // Müşterinin seçimi: kapıda kart → CREDIT_CARD, nakit → CASH
    govde.collectOnDeliveryType = siparis.kapidaTip === 'kart' ? 'CREDIT_CARD' : 'CASH';
  } else if (siparis.odeme === 'havale') {
    govde.orderPaymentType = 'BANK_TRANSFER';
  } else {
    govde.orderPaymentType = 'CREDIT_CARD'; // online (iyzico) ödeme
  }
  if (process.env.BASITKARGO_ADDRESS_ID) govde.addressId = process.env.BASITKARGO_ADDRESS_ID;
  if (process.env.BASITKARGO_BRAND_ID) govde.brandId = process.env.BASITKARGO_BRAND_ID;

  const otomatik = !!process.env.BASITKARGO_HANDLER;
  let yol = '/v2/order';
  if (otomatik) { yol = '/v2/order/barcode'; govde.handlerCode = process.env.BASITKARGO_HANDLER; }

  async function gonder(g, y) {
    const res = await fetch(BASE + y, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.BASITKARGO_TOKEN,
        'Content-Type': 'application/json',
        // Aynı sipariş tekrar denenirse (iyzico dönüşü yenilenirse vb.) ikinci gönderi açılmasın
        'Idempotency-Key': ('kurabiyes-' + siparis.siparisNo + '-' + (y.endsWith('barcode') ? 'b' : 'd')).slice(0, 255)
      },
      body: JSON.stringify(g)
    });
    const metin = await res.text();
    let json = null;
    try { json = JSON.parse(metin); } catch { /* json değil */ }
    return { ok: res.ok, status: res.status, json, metin };
  }

  try {
    let r = await gonder(govde, yol);
    // Otomatik barkod başarısız olursa (adres/ilçe yazımı, bakiye vb.) en azından taslak açılsın
    if (!r.ok && otomatik) {
      console.error('Basit Kargo barkod oluşturulamadı, taslağa düşülüyor:', r.status, r.metin.slice(0, 400));
      const { handlerCode, ...taslak } = govde;
      r = await gonder(taslak, '/v2/order');
      if (r.ok) {
        return { durum: 'TASLAK', id: r.json && r.json.id, not: 'KARGO: otomatik barkod olmadı, TASLAK açıldı — panelden barkod alın' };
      }
    }
    if (!r.ok) {
      console.error('Basit Kargo gönderi oluşturulamadı:', r.status, r.metin.slice(0, 400));
      return { durum: 'HATA', not: 'KARGO: oluşturulamadı (' + r.status + ') — Basit Kargo panelinden elle girin' };
    }
    const j = r.json || {};
    const dogrulamaUyari = j.validationFailed ? ' (adres doğrulaması uyarı verdi, panelde kontrol edin)' : '';
    if (otomatik && j.barcode) {
      return { durum: 'BARKOD', id: j.id, barcode: j.barcode, not: 'KARGO: barkod ' + j.barcode + dogrulamaUyari };
    }
    return { durum: 'TASLAK', id: j.id, not: 'KARGO: Basit Kargo taslağı açıldı' + dogrulamaUyari + ' — panelden barkod alın' };
  } catch (e) {
    console.error('Basit Kargo isteği başarısız:', e);
    return { durum: 'HATA', not: 'KARGO: Basit Kargo\'ya ulaşılamadı — panelden elle girin' };
  }
}

module.exports = { aktif, gonderiOlustur };
