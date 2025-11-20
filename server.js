require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// Configuración de seguridad: Solo tu página puede usar este servidor
app.use(cors({
    origin: [
        'https://alter-ias.github.io', 
        'http://localhost:5500',
        'http://127.0.0.1:5500'
    ]
}));

app.use(express.json());

// Ruta de prueba
app.get('/', (req, res) => {
    res.send('Backend de AlterStore funcionando correctamente 🚀');
});

// RUTA 1: OBTENER PRODUCTOS
app.get('/api/products', async (req, res) => {
    try {
        const products = await stripe.products.list({
            active: true,
            limit: 100,
            expand: ['data.default_price']
        });

        const formattedProducts = products.data.map(product => {
            const priceObj = product.default_price;
            return {
                id: product.id,
                nombre: product.name,
                precio: priceObj ? priceObj.unit_amount / 100 : 0,
                imagen_url: product.images[0] || '',
                descripcion: product.description,
                categoria: product.metadata.categoria || 'General',
                talla: product.metadata.talla || 'Única'
            };
        });

        res.json(formattedProducts);
    } catch (error) {
        console.error('Error Stripe:', error);
        res.status(500).json({ error: 'Error obteniendo productos' });
    }
});

// RUTA 2: CREAR PAGO
app.post('/api/create-checkout-session', async (req, res) => {
    const { items, shipping_rate_amount } = req.body;

    try {
        const lineItems = items.map(item => ({
            price_data: {
                currency: 'mxn',
                product_data: {
                    name: item.nombre,
                    images: item.imagen_url ? [item.imagen_url] : [],
                    metadata: { talla: item.selectedSize }
                },
                unit_amount: Math.round(item.precio * 100),
            },
            quantity: item.quantity,
        }));

        if (shipping_rate_amount > 0) {
            lineItems.push({
                price_data: {
                    currency: 'mxn',
                    product_data: { name: 'Costo de Envío' },
                    unit_amount: Math.round(shipping_rate_amount * 100),
                },
                quantity: 1,
            });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'oxxo'],
            line_items: lineItems,
            mode: 'payment',
            success_url: 'https://alter-ias.github.io/alterstore/beoriginalfit.html?status=success',
            cancel_url: 'https://alter-ias.github.io/alterstore/beoriginalfit.html?status=cancel',
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Error Checkout:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
