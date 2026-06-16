// Resmi iyzico kütüphanesini çağırıyoruz
const Iyzipay = require('iyzipay');

// Netlify'a kaydettiğimiz anahtarlar ile iyzico bağlantısını kuruyoruz
const iyzipay = new Iyzipay({
    apiKey: process.env.IYZICO_API_KEY,
    secretKey: process.env.IYZICO_SECRET_KEY,
    uri: 'https://api.iyzico.com' // Canlı hesap olduğu için gerçek API adresini kullanıyoruz
});

exports.handler = async (event, context) => {
    // Güvenlik için dışarıdan sadece POST isteklerini kabul ediyoruz
    if (event.httpMethod !== "POST") {
        return { 
            statusCode: 405, 
            headers: { "Access-Control-Allow-Origin": "*" },
            body: "Yalnızca POST istekleri kabul edilir." 
        };
    }

    try {
        // Sitenizden (sepetteki ürün fiyatı vb.) gelen veriyi okuyoruz
        const data = JSON.parse(event.body);
        const sepetTutari = data.totalPrice || "10.0"; // Eğer boş gelirse test amaçlı 10 TL

        // iyzico'nun zorunlu tuttuğu şablonu oluşturuyoruz
        const request = {
            locale: Iyzipay.LOCALE.TR,
            conversationId: Math.floor(Math.random() * 100000000).toString(), // Rastgele bir işlem numarası
            price: sepetTutari,
            paidPrice: sepetTutari,
            currency: Iyzipay.CURRENCY.TL,
            basketId: 'B' + Math.floor(Math.random() * 100000),
            paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
            // Ödeme başarılı veya başarısız olduğunda kullanıcının sitenizde yönleneceği sayfa:
            callbackUrl: 'https://www.kurabiyes.com/odeme-sonuc.html', 
            
            // Fatura ve Alıcı Bilgileri (iyzico bunları zorunlu tutar, dinamik de yapabilirsiniz)
            buyer: {
                id: 'BY789',
                name: 'Müşteri',
                surname: 'Adı',
                gsmNumber: '+905555555555',
                email: 'email@kurabiyes.com',
                identityNumber: '11111111111',
                lastLoginDate: '2026-06-16 12:00:00',
                registrationDate: '2026-06-16 12:00:00',
                registrationAddress: 'Türkiye',
                ip: event.headers['client-ip'] || '85.105.0.1',
                city: 'Istanbul',
                country: 'Turkey',
                zipCode: '34000'
            },
            shippingAddress: {
                contactName: 'Müşteri Adı',
                city: 'Istanbul',
                country: 'Turkey',
                address: 'Türkiye',
                zipCode: '34000'
            },
            billingAddress: {
                contactName: 'Müşteri Adı',
                city: 'Istanbul',
                country: 'Turkey',
                address: 'Türkiye',
                zipCode: '34000'
            },
            basketItems: [
                {
                    id: 'BI101',
                    name: 'Kurabiye Siparişi',
                    category1: 'Gıda',
                    itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,
                    price: sepetTutari
                }
            ]
        };

        // iyzico sunucularından güvenli ödeme formunu talep ediyoruz
        const result = await new Promise((resolve, reject) => {
            iyzipay.checkoutFormInitialize.create(request, function (err, result) {
                if (err) reject(err);
                else resolve(result);
            });
        });

        // iyzico'dan gelen cevabı sitenizin ön yüzüne (Frontend) gönderiyoruz
        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*" // CORS hatalarını önlemek için
            },
            body: JSON.stringify(result)
        };

    } catch (error) {
        return { 
            statusCode: 500, 
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: error.toString() }) 
        };
    }
};
