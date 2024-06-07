require('dotenv').config();
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);


async function getActiveCustomersWithSubscriptions() {
    try {
        const subscriptions = await stripe.subscriptions.list({
            status: 'active',  // Filtra por suscripciones activas
            limit: 100         // Puedes ajustar este número según tus necesidades
        });

        // Mapea los IDs de cliente de las suscripciones activas
        const activeCustomerIds = subscriptions.data.map(sub => sub.customer);

        // Eliminar duplicados, si es necesario
        const uniqueActiveCustomerIds = [...new Set(activeCustomerIds)];

        // Recupera detalles específicos de los clientes activos
        const activeCustomers = [];
        for (const customerId of uniqueActiveCustomerIds) {
            const customer = await stripe.customers.retrieve(customerId);
            // Convertir timestamp a fecha legible
            const createdDate = new Date(customer.created * 1000);
            // Formatear la fecha a un formato más comprensible
            const formattedDate = createdDate.toISOString().split('T')[0];  // Formato YYYY-MM-DD

            const customerData = {
                city: customer.address ? customer.address.city : null,
                country: customer.address ? customer.address.country : null,
                created: formattedDate,  // Usar la fecha formateada
                currency: customer.currency,
                email: customer.email,
                name: customer.name
            };
            activeCustomers.push(customerData);
        }

        // sdsdsds
        // const spreadsheetId = '853097278'; 
        // const sheetName = 'Consultorias';
        // const emailsToAdd = ['email1@example.com', 'email2@example.com'];

        // addEmailsToSheet(spreadsheetId, sheetName, emailsToAdd)
        // .then(() => console.log('Emails añadidos con éxito.'))
        // .catch(console.error);


        console.log('Clientes activos con suscripciones:', activeCustomers);
        return activeCustomers;
    } catch (error) {
        console.error('Error al obtener clientes activos:', error);
    }
}

getActiveCustomersWithSubscriptions();
