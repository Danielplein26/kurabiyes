# Basit Kargo bağlantısı — kurulum

Sipariş kesinleşince (kart ödemesi onaylanınca, kapıda ödeme ya da havale siparişi verilince)
Basit Kargo panelinde otomatik gönderi açılır. Varsayılan olarak **taslak** açılır: kargo kodu
üretilmez, ücret düşmez. Panelde kargo firmasını seçip barkodu tek tıkla alırsınız.

## Açmak için (10 dakika)

1. **Basit Kargo → hesap ayarları** bölümünden bir **API token** oluşturun.
2. **Netlify → Site yapılandırması → Ortam değişkenleri** bölümüne şunu ekleyin:
   - `BASITKARGO_TOKEN` = (kopyaladığınız token)
3. Netlify'da **Dağıtımlar → Dağıtımı tetikle → Siteyi yeniden dağıt** yapın (ortam değişkeni yeni dağıtımla devreye girer).
4. Deneme: kapıda ödemeyle küçük bir sipariş verin. Basit Kargo panelinde taslak sipariş görünmeli;
   Netlify **Formlar → siparisler** kaydında `kargo` alanında not yazar. Denemeden sonra taslağı panelden silin.

`BASITKARGO_TOKEN` tanımlı değilse hiçbir şey olmaz, site eskisi gibi çalışır. Basit Kargo'ya
ulaşılamazsa ya da hata verirse sipariş/ödeme **etkilenmez**; sipariş kaydında
"KARGO: ... elle girin" notu görünür.

## İsteğe bağlı ayarlar (aynı yerden ortam değişkeni olarak)

| Değişken | Ne işe yarar |
|---|---|
| `BASITKARGO_HANDLER` | Dolu ise taslak yerine **barkod da otomatik** alınır (bakiyenizden kargo ücreti düşer). Örn: `ECONOMIC` (en ucuz), `FAST` (en hızlı), `YURTICI`, `ARAS`, `SURAT`, `MNG`, `PTT`; kendi anlaşmanız için `SELF_YURTICI` gibi. Açmadan önce aşağıdaki ağırlıkları kontrol edin. |
| `BASITKARGO_ADDRESS_ID` | Gönderici adres kimliği (boşsa panelde varsayılan adres). |
| `BASITKARGO_BRAND_ID` | Marka/mağaza profili kimliği (boşsa varsayılan). |
| (kaldırıldı) | Kapıda tahsilat şekli artık müşteri seçer: nakit → `CASH`, kart → `CREDIT_CARD`. |

## Koli ölçüleri

`netlify/functions/lib/ortak.js` içindeki `URUNLER` listesinde her ürünün ağırlığı (kg) ve ölçüsü
(cm: yükseklik, genişlik, derinlik) koli ölçüleri verdiğiniz değerlerle yazıldı; ağırlıklar tahmini. Gerekirse düzeltin; desi
hesabı buna göre yapılır. Her adet ürün ayrı bir paket olarak gönderilir.

## Kapıda ödeme ücreti

Kargo firmasının tahsilat bedelini müşteriye yansıtmak isterseniz iki yerde aynı tutarı yazın:
- `netlify/functions/lib/ortak.js` → `KAPIDA_ODEME.ucret`
- `index.html` → `const KAPIDA_ODEME = { aktif: true, ucret: 50 }`

`aktif: false` yaparsanız kapıda ödeme seçeneği hem siteden kalkar hem sunucuda reddedilir.

## Not

Kart ödemesinde müşterinin adresi, ödeme iyzico sayfasında bittiği için Netlify Blobs'ta
(Netlify'ın kendi depolaması) geçici saklanır; gönderi açılınca kişisel veri silinir. Ek kurulum gerekmez.
