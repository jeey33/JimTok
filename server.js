const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

app.get("/", (req, res) => {
    res.send("✅ JiMToK Backend Online");
});

app.get("/tokens/:wallet/base", async (req, res) => {

    const wallet = req.params.wallet;

    try {

        const response = await fetch(
            `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "alchemy_getTokenBalances",
                    params: [
                        wallet
                    ]
                })
            }
        );

        const data = await response.json();
console.log(JSON.stringify(data, null, 2));
        res.json(data);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`✅ JiMToK backend running on port ${PORT}`);
});
