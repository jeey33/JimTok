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
    dustContainer.innerHTML = "🔍 Scan et traduction des poussières...";
    selectedTokens = [];
    updateButton();

    try {
        // Ta route Alchemy qui fonctionne sur ton serveur
        const response = await fetch(
            `https://jimtok-backend.onrender.com/tokens/${wallet}/base`
        );

        const data = await response.json();
        const tokens = data.result.tokenBalances;

        let processedTokens = [];

        // On boucle sur tes jetons trouvés pour aller chercher leurs vrais noms en direct
        for (const token of tokens) {
            const rawBalance = token.tokenBalance;

            // On élimine les lignes vides ou à zéro
            if (!rawBalance || rawBalance === "0x" || rawBalance === "0x0000000000000000000000000000000000000000000000000000000000000000") {
                continue;
            }

            try {
                // Connexion directe au contrat du jeton via MetaMask pour lui demander ses infos
                const tokenContract = new ethers.Contract(
                    token.contractAddress,
                    [
                        "function symbol() view returns (string)",
                        "function decimals() view returns (uint8)"
                    ],
                    provider
                );

                // Récupération du symbole (JIM, USDC, etc.) et des décimales
                const [symbol, decimals] = await Promise.all([
                    tokenContract.symbol().catch(() => "Jeton Inconnu"),
                    tokenContract.decimals().catch(() => 18)
                ]);

                // CONVERSION MAGIQUE : Fin des zéros infinis !
                const balanceBigInt = BigInt(rawBalance);
                const balanceFormatee = ethers.formatUnits(balanceBigInt, decimals);

                if (Number(balanceFormatee) > 0) {
                    processedTokens.push({
                        contractAddress: token.contractAddress,
                        symbol: symbol,
                        balanceRaw: rawBalance,
                        balanceFormatted: balanceFormatee,
                        chain: "base"
                    });
                }
            } catch (err) {
                console.log("Erreur décodage contrat : " + token.contractAddress, err);
                // Si la blockchain est trop lente à répondre, on garde quand même le jeton au format brut pour ne pas le perdre
                processedTokens.push({
                    contractAddress: token.contractAddress,
                    symbol: "Jeton",
                    balanceRaw: rawBalance,
                    balanceFormatted: (Number(BigInt(rawBalance)) / 1e18).toString(),
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

        // Affichage propre et lisible demandé
        div.innerHTML = `
            <input type="checkbox" style="margin-right: 15px; transform: scale(1.2);" />
            <div style="text-align: left; flex-grow: 1;">
                <strong style="color: #333; font-size: 16px;">${token.symbol}</strong>
                <span style="font-size: 11px; color: gray; display: block; word-break: break-all;">${token.contractAddress}</span>
                <div style="font-weight: bold; margin-top: 5px; color: #007bff;">
                    Quantité : ${Number(token.balanceFormatted).toLocaleString('fr-FR', { maximumFractionDigits: 6 })}
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
    
    // Règle de calcul proportionnelle : 1 unité convertie = 1 000 JIM
    let totalUnites = selectedTokens.reduce(
        (sum, t) => sum + Number(t.balanceFormatted || 0),
        0
    );

    const estimatedJIM = Math.floor(totalUnites * 1000);
    // Si la poussière est vraiment minuscule, on donne au moins un forfait de 500 JIM pour l'effort
    cleanButton.innerText = `🧹 Recevoir ~ ${estimatedJIM > 0 ? estimatedJIM : 500} JIM`;
}

cleanButton.onclick = async () => {
    try {
        for (const token of selectedTokens) {
            statusDiv.innerHTML = `⏳ Préparation du transfert pour ${token.symbol}...`;

            const tokenContract = new ethers.Contract(
                token.contractAddress,
                [
                    "function transfer(address to, uint256 amount) returns (bool)"
                ],
                signer
            );

            statusDiv.innerHTML = `⏳ Autorisation et transfert de ${token.symbol} en cours...`;

            const tx = await tokenContract.transfer(
                COLLECTION_WALLET,
                BigInt(token.balanceRaw)
            );

            statusDiv.innerHTML = `⏳ Attente de la validation blockchain...`;
            await tx.wait();

            const quantiteEnvoyee = Number(token.balanceFormatted);
            const jimGagnes = Math.floor(quantiteEnvoyee * 1000);

            alert(`🎉 Réussite !\n\nTu as envoyé tes poussières de ${token.symbol}.\nTu as droit à : ${jimGagnes > 0 ? jimGagnes : 500} JIM.`);
        }

        statusDiv.innerHTML = "✅ Toutes les poussières sélectionnées ont été nettoyées !";
        selectedTokens = [];
        updateButton();
        
        const currentAddress = await signer.getAddress();
        scanDust(currentAddress);

    } catch(err) {
        console.log(err);
        statusDiv.innerHTML = "❌ Transaction annulée ou erreur réseau";
    }
};
