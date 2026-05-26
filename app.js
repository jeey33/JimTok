const connectButton = document.getElementById("connectButton");
const dustContainer = document.getElementById("dustContainer");
const cleanButton = document.getElementById("cleanButton");
const statusDiv = document.getElementById("status");

const CONTRACT_JIMTOK =
"0xC8c75f020A9CCA652e9D2C2c13Fa3C7522D2626a";

let provider;
let signer;
let selectedTokens = [];

const NETWORKS = [
  "base",
  "eth",
  "polygon",
  "bsc",
  "arbitrum",
  "optimism"
];

connectButton.onclick = async () => {

    if (!window.ethereum) {
        alert("MetaMask requis");
        return;
    }

    provider = new ethers.BrowserProvider(window.ethereum);

    await provider.send("eth_requestAccounts", []);

    signer = await provider.getSigner();

    const address = await signer.getAddress();

    statusDiv.innerHTML =
    "✅ Wallet connecté : " + address;

    scanDust(address);
};

async function scanDust(wallet) {

    dustContainer.innerHTML =
    "🔍 Scan des poussières...";

    let allTokens = [];

    for (const chain of NETWORKS) {

        try {

            const response = await fetch(
                `https://jimtok-backend.onrender.com/tokens/${wallet}/${chain}`
            );

            const tokens = await response.json();

            tokens.forEach(token => {

                const balance =
                Number(token.balance_formatted);

                const usd =
                Number(token.usd_value || 0);

                if (
                    balance > 0 &&
                    usd < 10 &&
                    token.possible_spam !== true
                ) {
                    allTokens.push({
                        ...token,
                        chain
                    });
                }

            });

        } catch(err) {
            console.log(err);
        }

    }

    renderTokens(allTokens);
}

function renderTokens(tokens){

    dustContainer.innerHTML = "";

    if(tokens.length === 0){
        dustContainer.innerHTML =
        "Aucune poussière détectée.";
        return;
    }

    tokens.forEach(token => {

        const div = document.createElement("div");

        div.className = "token";

        div.innerHTML = `
            <input type="checkbox" />

            <strong>${token.symbol}</strong>

            <div class="small">
                ${token.balance_formatted}
                ≈ $${Number(token.usd_value || 0).toFixed(2)}
            </div>
        `;

        const checkbox =
        div.querySelector("input");

        checkbox.addEventListener("change", e => {

            if(e.target.checked){
                selectedTokens.push(token);
            }else{
                selectedTokens =
                selectedTokens.filter(
                    t => t.token_address !== token.token_address
                );
            }

            updateButton();

        });

        dustContainer.appendChild(div);

    });

}

function updateButton(){

    if(selectedTokens.length === 0){
        cleanButton.style.display = "none";
        return;
    }

    cleanButton.style.display = "block";

    let total =
    selectedTokens.reduce(
        (sum, t) => sum + Number(t.usd_value || 0),
        0
    );

    const estimatedJIM =
    Math.floor(total * 1000);

    cleanButton.innerText =
    `Recevoir ~ ${estimatedJIM} JIM`;

}

cleanButton.onclick = async () => {

    try {

        for(const token of selectedTokens){

            const tokenContract =
            new ethers.Contract(
                token.token_address,
                [
                    "function transfer(address to, uint amount) returns (bool)"
                ],
                signer
            );

            statusDiv.innerHTML =
            `⏳ Transfert ${token.symbol}...`;

            const tx =
            await tokenContract.transfer(
                CONTRACT_JIMTOK,
                BigInt(token.balance)
            );

            await tx.wait();

        }

        statusDiv.innerHTML =
        "✅ Poussières envoyées au contrat JiMToK";

    } catch(err){

        console.log(err);

        statusDiv.innerHTML =
        "❌ Transaction annulée";

    }

};