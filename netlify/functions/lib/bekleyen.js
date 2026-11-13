// ============================================================
// Bekleyen siparişler (Netlify Blobs)
// ============================================================
// iyzico ödemesi sitenin dışında (iyzico sayfasında) tamamlanır; ödeme sonucu
// geri geldiğinde müşterinin adresi elimizde olmaz. Bu yüzden ödeme başlarken
// sipariş bilgisi burada saklanır, ödeme doğrulanınca okunup Basit Kargo'ya
// gönderi açılır. İşlenen kayıtlarda kişisel veri tutulmaz (sadece "islendi" işareti).
// Blobs çalışmazsa ödeme akışı etkilenmez; sadece gönderi otomatik açılmaz.
// ============================================================

const { connectLambda, getStore } = require('@netlify/blobs');

function depo(event) {
  try {
    if (event && event.blobs) connectLambda(event);
    return getStore('bekleyen-siparisler');
  } catch (e) {
    console.error('Netlify Blobs hazırlanamadı:', e);
    return null;
  }
}

async function kaydet(event, siparisNo, veri) {
  try {
    const d = depo(event);
    if (!d) return false;
    await d.setJSON(siparisNo, veri);
    return true;
  } catch (e) {
    console.error('Bekleyen sipariş saklanamadı:', e);
    return false;
  }
}

async function oku(event, siparisNo) {
  try {
    const d = depo(event);
    if (!d) return null;
    return await d.get(siparisNo, { type: 'json' });
  } catch (e) {
    console.error('Bekleyen sipariş okunamadı:', e);
    return null;
  }
}

// Kişisel verileri sil, sadece "işlendi" işareti bırak (tekrarlanan iyzico dönüşlerinde çift gönderi açılmasın)
async function islendiIsaretle(event, siparisNo) {
  try {
    const d = depo(event);
    if (!d) return;
    await d.setJSON(siparisNo, { islendi: true, tarih: new Date().toISOString() });
  } catch (e) {
    console.error('Bekleyen sipariş işaretlenemedi:', e);
  }
}

module.exports = { kaydet, oku, islendiIsaretle };
