// server.js
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

let access_token;
let refresh_token;
let realmId;


app.get('/auth/quickbooks', (req, res) => {
    const authorizationUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${process.env.CLIENT_ID}&scope=com.intuit.quickbooks.accounting&redirect_uri=${process.env.REDIRECT_URI}&response_type=code&state=12345`;
    res.redirect(authorizationUrl);
});


app.get('/callback', async (req, res) => {
    const authorizationCode = req.query.code;
    if (!authorizationCode) {
        return res.status(400).send('Authorization code is missing');
    }

    try {
        const tokenResponse = await axios.post('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', new URLSearchParams({
            grant_type: 'authorization_code',
            code: authorizationCode,
            redirect_uri: process.env.REDIRECT_URI,
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET
        }).toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        access_token = tokenResponse.data.access_token;
        refresh_token = tokenResponse.data.refresh_token;
        realmId = tokenResponse.data.realmId;

        res.json({
            message: 'OAuth 2.0 authentication successful',
            access_token,
            refresh_token,
            company_id: realmId
        });
    } catch (error) {
        console.error('Error exchanging authorization code:', error.response?.data || error.message);
        res.status(500).send('Error exchanging authorization code for tokens');
    }
});


app.post('/create-invoice', async (req, res) => {
    if (!access_token || !realmId) {
        return res.status(400).send('Access token or Company ID is missing');
    }


    const { clientName, clientEmail, invoiceTotal, invoiceDetails } = req.body;


    const lineItems = invoiceDetails.map(detail => ({
        "Description": detail.description,
        "Amount": detail.totalPrice,
        "DetailType": "SalesItemLineDetail",
        "SalesItemLineDetail": {
            "ItemRef": {
                "name": detail.product
            },
            "Qty": detail.qty,
            "UnitPrice": detail.unitPrice
        }
    }));


    const invoiceData = {
        "CustomerRef": {
            "name": clientName,
            "Email": clientEmail
        },
        "Line": lineItems,
        "TotalAmt": invoiceTotal
    };

    try {
        const headers = {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };


        const response = await axios.post(`https://quickbooks.api.intuit.com/v3/company/${realmId}/invoice`, invoiceData, { headers });

        res.json({
            message: 'Invoice created successfully in QuickBooks',
            invoice: response.data
        });
    } catch (error) {
        console.error('Error creating invoice:', error.response?.data || error.message);
        res.status(500).send('Error creating invoice in QuickBooks');
    }
});


app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
