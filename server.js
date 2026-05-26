const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());

const MORALIS_API_KEY =
process.env.MORALIS_API_KEY;

app.get("/tokens/:wallet/:chain", async (req,res)=>{

    const wallet = req.params.wallet;
    const chain = req.params.chain;

    try {

        const response = await fetch(
`https://deep-index.moralis.io/api/v2.2/${wallet}/erc20?chain=${chain}`,
        {
            headers:{
                "X-API-Key": MORALIS_API_KEY
            }
        });

        const data = await response.json();

        res.json(data);

    } catch(err){

        res.status(500).json({
            error:err.message
        });

    }

});

app.listen(3000, ()=>{
    console.log("JiMToK backend running");
});