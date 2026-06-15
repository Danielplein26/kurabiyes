# Kurabiye's — E-Ticaret Sitesi

Yunus Usta'nın leblebi kurabiyesi için hazırlanmış, iyzico ödeme altyapısına
bağlanmaya hazır basit bir e-ticaret sitesi. Site, kod bilmeden içerik
düzenleyebileceğiniz bir **yönetim paneli** (Decap CMS) ile birlikte gelir.

## Klasör İçeriği

```
kurabiyes-site/
├── index.html               → Ana site (içeriği content/site-data.json'dan okur)
├── content/
│   └── site-data.json       → Tüm metinler, fiyatlar, fotoğraflar (PANEL bunu düzenler)
├── admin/
│   ├── index.html            → Yönetim paneli ekranı
│   └── config.yml            → Panelin hangi alanları göstereceğinin ayarı
├── odeme-basarili.html       → Ödeme sonrası "başarılı" sayfası
├── odeme-basarisiz.html      → Ödeme sonrası "başarısız" sayfası
├── images/                   → Ürün fotoğrafları
└── server-ornegi/            → iyzico için örnek backend (Node.js)
    ├── server.js
    ├── package.json
    └── .env.example
```

---

## 🧰 Yönetim Panelini Açma (Tek Seferlik Kurulum)

Panel, sitenizin **GitHub üzerinden** Netlify'a bağlı olmasını gerektirir
(Netlify "Git Gateway" özelliği için). Aşağıdaki adımları sırayla yapın.
Toplamda 10-15 dakika sürer ve bir kerelik yapılır.

### 1. Siteyi GitHub'a bağlayın (eğer bağlı değilse)

- Bu klasördeki tüm dosyalarla bir GitHub deposu (repository) oluşturun.
- Netlify panelinde: **Site configuration → Build & deploy → Link repository**
  (veya yeni bir site oluştururken "Import an existing project" ile bu
  GitHub deposunu seçin).
- Bu sayede, GitHub'da yaptığınız her değişiklik otomatik olarak
  yayına alınır — panel de aslında arka planda bu deponuza yazıyor olacak.

### 2. Netlify Identity'yi açın

- Netlify panelinde sitenize girin → **Site configuration → Identity**
  → **Enable Identity** butonuna basın.

### 3. Git Gateway'i etkinleştirin

- Aynı **Identity** sayfasında, alt kısımda **Services** bölümünde
  **Git Gateway** → **Enable Git Gateway** butonuna basın.

### 4. Kendinizi kullanıcı olarak davet edin

- **Identity** sayfasında **Invite users** butonuna basın, kendi
  e-posta adresinizi girin.
- E-postanıza gelen daveti açın, bir şifre belirleyin.

### 5. Panele giriş yapın

- Tarayıcınızda `www.kurabiyes.com/admin/` adresine gidin.
- E-posta ve belirlediğiniz şifre ile giriş yapın.
- Karşınıza "Ana Sayfa İçeriği" başlığı altında düzenleyebileceğiniz
  bölümler gelecek:
  - **Hero** (ana başlık, açıklama, kapak fotoğrafı)
  - **Ürünler** (isim, fiyat, açıklama, fotoğraf — istediğiniz kadar ürün ekleyip çıkarabilirsiniz)
  - **Hakkımızda / Hikaye** (paragraflar, zaman çizelgesi, fotoğraf)
  - **Galeri Fotoğrafları**
  - **İletişim Bilgileri** (telefon, adres, e-posta, çalışma saatleri)
- Değişiklik yapıp **Publish** (Yayınla) butonuna basın. 1-2 dakika
  içinde site güncellenir.

> Not: Panel üzerinden yüklediğiniz yeni fotoğraflar otomatik olarak
> `images/` klasörüne kaydedilir.

---

## Site Nasıl Çalışıyor?


- **Ürünler:** 5'li paket (500 TL), 10'lu paket (900 TL) ve 36'lı koli
  (2.700 TL) olarak üç ürün tanımlı. Fiyatlar `index.html` içindeki
  `PRODUCTS` nesnesinde (JavaScript) tutulur — değiştirmek isterseniz
  oradaki `price` değerlerini güncellemeniz yeterli.
- **Sepet:** Ürünler tarayıcı belleğinde (sayfa açıkken) tutulur, sağdan
  açılan bir sepet penceresinde gösterilir.
- **Ödeme formu:** Müşteri adı, telefon, e-posta ve adres bilgilerini
  topladıktan sonra "iyzico ile Güvenli Ödeme Yap" butonuna basılır.

## ⚠️ Önemli: iyzico Entegrasyonu İçin Backend Gerekiyor

iyzico'nun ödeme formunu başlatmak (Checkout Form Initialize), **gizli bir
API anahtarı** ile yapılan bir sunucu (backend) çağrısı gerektirir. Bu
anahtar güvenlik nedeniyle asla bir web sitesinin HTML/JavaScript koduna
yazılamaz — yazılırsa herkes görebilir ve kötüye kullanabilir.

Bu yüzden `index.html` sadece **frontend** (ön yüz) kısmını içerir ve
"Ödeme Yap" butonuna basıldığında `/api/odeme/baslat` adresine bir istek
gönderir. Bu isteği karşılayacak basit bir örnek sunucu kodu
`server-ornegi/server.js` içinde verilmiştir.

### Kurulum Adımları

1. **iyzico mağaza hesabı açın**: [iyzico.com](https://www.iyzico.com)
   üzerinden mağaza başvurusu yapın, onaylandıktan sonra panelden
   **API Key** ve **Secret Key** bilgilerinizi alın (önce test/sandbox
   anahtarlarıyla deneme yapmanız önerilir).

2. **Sunucuyu kurun**:
   ```bash
   cd server-ornegi
   npm install
   cp .env.example .env
   ```
   `.env` dosyasını açıp kendi `IYZICO_API_KEY` ve `IYZICO_SECRET_KEY`
   bilgilerinizi girin.

3. **Çalıştırın**:
   ```bash
   npm start
   ```
   Sunucu varsayılan olarak `http://localhost:3000` adresinde çalışır ve
   `index.html` dosyasını da otomatik olarak yayınlar.

4. **Canlıya alma**: Bir Node.js destekleyen hosting/sunucu üzerine
   (örnek: bir VPS, Render, Railway, DigitalOcean App Platform vb.)
   `server-ornegi` klasörünü yükleyin, ortam değişkenlerini (env vars)
   panelden tanımlayın ve `IYZICO_BASE_URL` değerini canlı (production)
   adresine çevirin.

5. **Domain**: `www.kurabiyes.com` alan adını satın aldıktan sonra DNS
   ayarlarını seçtiğiniz hosting sağlayıcısına yönlendirin.

> Not: Sadece statik dosya barındıran hizmetler (yalnızca HTML/CSS/JS
> sunan, kod çalıştırmayan paylaşımlı hostingler) `server.js`'i
> çalıştıramaz. iyzico entegrasyonu için Node.js (veya PHP/Python ile
> eşdeğer bir iyzico SDK'sı) çalıştırabilen bir sunucuya ihtiyacınız var.

## İçerik / Metin Güncellemeleri

İçerik güncellemelerinin **tamamı artık `/admin/` panelinden** yapılabilir
(yukarıdaki kurulum adımlarını tamamladıktan sonra):

- **Fiyatlar, paket içerikleri**: "Ürünler" bölümünden her ürünün fiyatını,
  açıklamasını ve fotoğrafını değiştirebilir, yeni ürün ekleyip
  çıkarabilirsiniz.
- **Telefon / WhatsApp, adres, e-posta, çalışma saatleri**: "İletişim
  Bilgileri" bölümünden.
- **Hikaye metni ve zaman çizelgesi**: "Hakkımızda / Hikaye" bölümünden.
- **Ana sayfa başlığı ve kapak fotoğrafı**: "Hero" bölümünden.
- **Galeri fotoğrafları**: "Galeri Fotoğrafları" bölümünden.

Panel kullanılamıyorsa (veya kurulum yapılmadıysa), aynı bilgiler doğrudan
`content/site-data.json` dosyasında düzenlenebilir — dosya, basit
metin/sayı alanlarından oluşan bir JSON yapısıdır.

## Yasal / Operasyonel Hatırlatmalar

- E-ticaret sitesi açmadan önce **Mesafeli Satış Sözleşmesi**, **İptal ve
  İade Şartları**, **KVKK Aydınlatma Metni** gibi sayfaların eklenmesi
  Türkiye'deki e-ticaret mevzuatı (ETBİS kaydı dahil) açısından gereklidir.
  Bu sayfalar mevcut tasarıma uyacak şekilde eklenebilir.
- iyzico, mağaza başvurunuzda işletme/şahıs bilgilerinizi ve banka hesap
  bilgilerinizi talep edecektir.
