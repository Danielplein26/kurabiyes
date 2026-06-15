# Kurabiye's — E-Ticaret Sitesi

Yunus Usta'nın leblebi kurabiyesi için hazırlanmış, iyzico ödeme altyapısına
bağlanmaya hazır basit bir e-ticaret sitesi.

## Klasör İçeriği

```
kurabiyes-site/
├── index.html              → Ana site (ürünler, hikaye, sepet, ödeme formu)
├── odeme-basarili.html      → Ödeme sonrası "başarılı" sayfası
├── odeme-basarisiz.html     → Ödeme sonrası "başarısız" sayfası
├── images/                  → Ürün fotoğrafları
└── server-ornegi/           → iyzico için örnek backend (Node.js)
    ├── server.js
    ├── package.json
    └── .env.example
```

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

- **Telefon / WhatsApp**: `0539 289 16 30` — `index.html` içinde
  "İletişim" ve alt bilgi (footer) bölümlerinde geçer.
- **Adres**: Yıldıztepe Mahallesi, Oruçkaptan Sokak No:2/A,
  Odunpazarı / Eskişehir.
- **Hikaye metni**: "Hikayemiz" bölümünde Yunus Usta'nın hikayesi yer
  alır; istediğiniz gibi düzenleyebilirsiniz.
- **Fotoğraflar**: `images/` klasöründeki dosyaları değiştirerek kendi
  ürün fotoğraflarınızı koyabilirsiniz (aynı dosya adlarını kullanmanız
  veya `index.html` içindeki `src="images/..."` yollarını güncellemeniz
  gerekir).

## Yasal / Operasyonel Hatırlatmalar

- E-ticaret sitesi açmadan önce **Mesafeli Satış Sözleşmesi**, **İptal ve
  İade Şartları**, **KVKK Aydınlatma Metni** gibi sayfaların eklenmesi
  Türkiye'deki e-ticaret mevzuatı (ETBİS kaydı dahil) açısından gereklidir.
  Bu sayfalar mevcut tasarıma uyacak şekilde eklenebilir.
- iyzico, mağaza başvurunuzda işletme/şahıs bilgilerinizi ve banka hesap
  bilgilerinizi talep edecektir.
