# Kurabiye's — iyzico ile Tam Online Ödeme Kurulumu

Bu paket, sitenize **gerçek kredi kartı ödemesi** (iyzico) ekler ve gelen
**siparişleri size e-posta + Netlify panelinde liste** olarak ulaştırır.
Ayrı bir sunucu kiralamanıza gerek yok — her şey Netlify üzerinde çalışır.

## Bu pakette ne var?

```
index.html                       → Site (fotoğraflar içine gömülü, ödeme butonu artık çalışır)
odeme-basarili.html               → Ödeme başarılıysa müşterinin gördüğü sayfa
odeme-basarisiz.html              → Ödeme başarısızsa görünen sayfa
netlify.toml                      → Netlify ayarı (derleme yok, fonksiyonlar açık)
package.json                      → iyzico kütüphanesini Netlify'a kurar
netlify/
  └── functions/
        ├── odeme-baslat.js        → Ödemeyi başlatır
        └── odeme-sonuc.js         → Ödemeyi doğrular, siparişi kaydeder
```

---

## Nasıl çalışıyor? (kısaca)

1. Müşteri sepeti doldurur, bilgilerini girer, "iyzico ile Güvenli Ödeme Yap" der.
2. `odeme-baslat` fonksiyonu iyzico'da güvenli bir ödeme sayfası açar ve
   müşteriyi oraya yollar. Aynı anda siparişi **"ÖDEME BEKLENİYOR"** olarak
   sipariş kutunuza düşürür (müşterinin adı, telefonu, adresi, ne aldığı).
3. Müşteri karta bilgilerini iyzico'nun güvenli sayfasında girer (kart
   bilgisi sizin sitenize hiç uğramaz).
4. Ödeme bitince iyzico, `odeme-sonuc` fonksiyonunu çağırır. Bu fonksiyon
   ödemenin gerçekten başarılı olduğunu iyzico'ya **doğrulatır**, başarılıysa
   siparişi **"ÖDENDİ ✓"** olarak işaretler ve müşteriyi teşekkür sayfasına
   yollar.

Yani sipariş kutunuzda her sipariş için önce bir "ÖDEME BEKLENİYOR" (tüm
iletişim bilgileriyle), ödeme tamamlanınca da aynı sipariş numarasıyla bir
"ÖDENDİ ✓" satırı görürsünüz.

---

## KURULUM — Adım Adım

### 1. iyzico mağaza hesabı açın  *(sizin yapmanız gerekir)*

- https://www.iyzico.com adresinden **mağaza başvurusu** yapın. Şahıs ya da
  şirket olarak başvurabilirsiniz; kimlik/işletme ve banka bilgileri istenir.
  Onay birkaç gün sürebilir, **şimdiden başlatın**.
- Onaylanınca iyzico panelinde **Ayarlar → API Anahtarları** bölümünden iki
  şey alacaksınız:
  - **API Key**
  - **Secret Key**
- iyzico hem **test (sandbox)** hem **canlı (production)** için ayrı
  anahtarlar verir. **Önce test anahtarlarıyla** deneyin, her şey çalışınca
  canlıya geçin.

### 2. Dosyaları GitHub'a yükleyin

En kolay ve hatasız yöntem, dosyaları GitHub'da tek tek "yol yazarak"
oluşturmaktır (klasör sürükleme derdi olmaz):

GitHub deponuzda (`github.com/Danielplein26/kurabiyes`) her dosya için:
**Add file → Create new file** deyin, üstteki isim kutusuna tam yolu yazıp
içeriğini yapıştırın, **Commit** edin. Şu dosyaları oluşturun:

- `netlify.toml`
- `package.json`
- `netlify/functions/odeme-baslat.js`  ← "/" yazınca GitHub klasörü otomatik açar
- `netlify/functions/odeme-sonuc.js`
- `odeme-basarili.html`
- `odeme-basarisiz.html`

`index.html` zaten var; onu güncellemek için mevcut `index.html`'e tıklayın →
kalem (Edit) → içeriği bu paketteki yeni `index.html` ile değiştirin → Commit.

> `index.html` büyük bir dosya (fotoğraflar içine gömülü). Kopyalarken
> tamamını seçtiğinizden emin olun.

### 3. Netlify'da ortam değişkenlerini girin  *(anahtarlar burada saklanır)*

Netlify panelinde sitenize girin → **Site configuration → Environment
variables → Add a variable**. Şu 4 değişkeni ekleyin:

| Anahtar adı         | Değer (test için)                       |
| ------------------- | --------------------------------------- |
| `IYZICO_API_KEY`    | iyzico'dan aldığınız **API Key**        |
| `IYZICO_SECRET_KEY` | iyzico'dan aldığınız **Secret Key**     |
| `IYZICO_BASE_URL`   | `https://sandbox-api.iyzipay.com`       |
| `SITE_URL`          | `https://kurabiyes.com`                 |

> Güvenlik: API ve Secret Key **yalnızca buraya** girilir, asla dosyaların
> içine yazılmaz. Bu yüzden güvenlidir.

### 4. Build ayarını temizleyin (eski "cecil build" hatası için)

Netlify → **Site configuration → Build & deploy → Build settings → Edit
settings**:
- **Build command**: boş bırakın
- **Publish directory**: `.` (tek nokta)
(Zaten `netlify.toml` bunu ayarlıyor; yine de kontrol edin.)

### 5. Sipariş bildirim e-postasını açın

Sipariş kutusu **Netlify Forms** ile çalışır. Bildirim almak için:
Netlify → **Forms** (sol menü) → ilk gerçek sipariş geldikten sonra
`siparisler` formu burada görünür. **Form → Settings → Form notifications
→ Add notification → Email notification** ile kendi e-postanızı ekleyin.
Böylece her siparişte size e-posta gelir; tüm siparişler de bu sayfada
liste halinde durur.

### 6. Test edin (canlı paraya geçmeden)

`IYZICO_BASE_URL` test adresindeyken, sitede bir sipariş verin. iyzico'nun
test kartlarından biriyle ödeme yapabilirsiniz, örnek:
- **Kart No:** 5528 7900 0000 0008
- **Son kullanma:** 12/30 · **CVC:** 123 · İsim: herhangi bir şey
(iyzico'nun güncel test kartları için: iyzico geliştirici dokümanları.)

Ödeme sonrası "teşekkür" sayfasına dönmeli ve Netlify **Forms → siparisler**
altında hem "ÖDEME BEKLENİYOR" hem "ÖDENDİ ✓" satırlarını görmelisiniz.

### 7. Canlıya geçin

Her şey test ortamında çalışıyorsa, Netlify ortam değişkenlerinde:
- `IYZICO_API_KEY` ve `IYZICO_SECRET_KEY` → **canlı** anahtarlarınızla değiştirin
- `IYZICO_BASE_URL` → `https://api.iyzipay.com` yapın

Değişkenleri değiştirdikten sonra **Deploys → Trigger deploy → Deploy site**
ile yeniden yayınlayın. Artık gerçek ödemeler alınır.

---

## Önemli notlar

- **Kargo/teslimat ücreti**: Şu an fiyatlara kargo dahil değil. İsterseniz
  sepete kargo ücreti ekleyebiliriz, söylemeniz yeterli.
- **Yasal sayfalar**: Türkiye'de online satış için **Mesafeli Satış
  Sözleşmesi**, **İptal/İade Şartları**, **KVKK Aydınlatma Metni** ve
  **ETBİS kaydı** gerekir. iyzico mağaza onayı da çoğu zaman bunları ister.
  Bu sayfaları siteye eklememi isterseniz hazırlayabilirim.
- **Sipariş kutusu** veritabanı değildir; siparişler Netlify Forms'ta
  birikir ve e-posta ile gelir. Küçük/orta hacim için fazlasıyla yeterlidir.
- Bir sorun olursa, Netlify → **Functions** altından `odeme-baslat` ve
  `odeme-sonuc` loglarına bakılarak hatanın sebebi görülebilir.
