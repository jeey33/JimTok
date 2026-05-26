const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// ===============================
// CLÉ MORALIS (Render Environment Variable)
// ===============================

const MORALIS_API_KEY = process.env.MORALIS_API_KEY;

// ===============================
// PAGE D'ACCUEIL
// ===============================

app.get("/", (req, res) => {

    res.send("✅ JiMToK Backend Online");

});

// ===============================
// ROUTE SCAN TOKENS
// ===============================

app.get("/tokens/:wallet/:chain", async (req, res) => {

    const wallet = req.params.wallet;
    const chain = req.params.chain;

    try {

        const response = await fetch(
            `https://deep-index.moralis.io/api/v2.2/${wallet}/erc20?chain=${chain}`,
            {
                method: "GET",
                headers: {
                    "accept": "application/json",
                    "X-API-Key": MORALIS_API_KEY
                }
            }
        );

        const data = await response.json();

        res.json(data);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});

// ===============================
// LANCEMENT SERVEUR
// ===============================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`✅ JiMToK backend running on port ${PORT}`);

});